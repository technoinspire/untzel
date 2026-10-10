// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The insert chain of one slot:
//! up to nine effects in the order of the text, after the voices and before
//! gain, duck, pan and the sends. With no effect the slot keeps the plain mono path,
//! bit for bit; the chain only runs while it has effects or is fading.
//!
//! Order changes go through `stage` and `commit` (message handler) and take effect at a
//! frame: entering the chain fades from dry in 20 ms, leaving fades to dry in 20 ms, a
//! new order fades to dry and back in 40 ms. Nothing here allocates after `new`.
//!
//! Over 300 lines: staging, commit and the crossfades share one order and its fades on the audio thread.

use crate::fx::inserts::chorus::Chorus;
use crate::fx::inserts::comp::Compressor;
use crate::fx::inserts::crush::Crush;
use crate::fx::inserts::distort::distort;
use crate::fx::inserts::eq::Eq;
use crate::fx::inserts::filter::StereoSvf;
use crate::fx::inserts::noise_gate::NoiseGate;
use crate::fx::inserts::phaser::Phaser;
use crate::math::SILENCE;
use crate::params::{EFFECT_BASE, ParamBank};

/// Effect kinds, the numbers of `untzel_effect_order`.
pub const LOWPASS: u8 = 0;
pub const HIGHPASS: u8 = 1;
pub const DISTORT: u8 = 2;
pub const CRUSH: u8 = 3;
pub const CHORUS: u8 = 4;
pub const PHASER: u8 = 5;
pub const EQ: u8 = 6;
pub const COMP: u8 = 7;
pub const GATE: u8 = 8;
pub const KINDS: usize = 9;

/// Effect parameter positions (DSP index − EFFECT_BASE), `params.rs` order.
mod position {
    pub const LOWPASS: usize = 0;
    pub const LOWPASS_Q: usize = 1;
    pub const HIGHPASS: usize = 2;
    pub const HIGHPASS_Q: usize = 3;
    pub const DISTORT: usize = 4;
    pub const CRUSH: usize = 5;
    pub const CHORUS: usize = 6;
    pub const CHORUS_RATE: usize = 7;
    pub const PHASER: usize = 8;
    pub const PHASER_RATE: usize = 9;
    pub const EQ_LOW: usize = 10;
    pub const EQ_MID: usize = 11;
    pub const EQ_MID_FREQ: usize = 12;
    pub const EQ_HIGH: usize = 13;
    pub const COMP: usize = 14;
    pub const GATE: usize = 15;
}

const FADE_SECONDS: f32 = 0.020;
/// The chain keeps running on silence for this long after its output goes quiet.
const TAIL_SECONDS: f32 = 0.100;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Fade {
    Steady,
    /// Fading to dry; at 0 the pending order replaces the current one.
    Out,
    /// Fading from dry to the current order.
    In,
}

pub struct InsertChain {
    sample_rate: f32,
    order: [u8; KINDS],
    count: usize,
    staged: [u8; KINDS],
    next: [u8; KINDS],
    next_count: usize,
    /// Frame at which `next` replaces `order`; None when nothing is pending.
    switch_at: Option<f64>,
    fade: Fade,
    /// Wet amount 0..1 of the chain output against the dry voice signal.
    wet: f32,
    fade_step: f32,
    quiet_frames: u32,
    tail_frames: u32,
    lowpass: StereoSvf,
    highpass: StereoSvf,
    crush: Crush,
    chorus: Chorus,
    phaser: Phaser,
    eq: Eq,
    comp: Compressor,
    gate: NoiseGate,
}

impl InsertChain {
    /// Allocates the chorus lines. Message handler only.
    pub fn new(sample_rate: f32) -> Self {
        InsertChain {
            sample_rate,
            order: [0; KINDS],
            count: 0,
            staged: [0; KINDS],
            next: [0; KINDS],
            next_count: 0,
            switch_at: None,
            fade: Fade::Steady,
            wet: 0.0,
            fade_step: 1.0 / (FADE_SECONDS * sample_rate).max(1.0),
            quiet_frames: 0,
            tail_frames: (TAIL_SECONDS * sample_rate) as u32,
            lowpass: StereoSvf::default(),
            highpass: StereoSvf::default(),
            crush: Crush::default(),
            chorus: Chorus::new(sample_rate),
            phaser: Phaser::default(),
            eq: Eq::default(),
            comp: Compressor::new(sample_rate),
            gate: NoiseGate::new(sample_rate),
        }
    }

    /// Writes `kind` at `position` of the order being prepared. False when refused.
    pub fn stage(&mut self, position: u32, kind: u32) -> bool {
        if position as usize >= KINDS || kind as usize >= KINDS {
            return false;
        }
        self.staged[position as usize] = kind as u8;
        true
    }

    /// The first `count` staged kinds become the order at `at_frame`. A repeated kind
    /// refuses the whole commit and keeps the current chain.
    pub fn commit(&mut self, count: u32, at_frame: f64) -> bool {
        let count = count as usize;
        if count > KINDS || !at_frame.is_finite() {
            return false;
        }
        let mut seen = [false; KINDS];
        for &kind in &self.staged[..count] {
            if seen[kind as usize] {
                return false;
            }
            seen[kind as usize] = true;
        }
        self.next[..count].copy_from_slice(&self.staged[..count]);
        self.next_count = count;
        self.switch_at = Some(at_frame);
        true
    }

    /// Whether the chain must run this sub-block.
    pub fn is_active(&self) -> bool {
        self.count > 0 || self.wet > 0.0 || self.switch_at.is_some()
    }

    /// Whether the chain still carries a tail (for the slot's silence and aposentadoria).
    pub fn has_tail(&self) -> bool {
        self.is_active() && self.quiet_frames < self.tail_frames
    }

    /// Starts a pending order once `frame` reaches it.
    pub fn apply_due(&mut self, frame: f64) {
        let Some(at) = self.switch_at else {
            return;
        };
        if frame < at || self.fade == Fade::Out {
            return;
        }
        let same =
            self.next_count == self.count && self.next[..self.count] == self.order[..self.count];
        if same {
            self.switch_at = None;
            return;
        }
        if self.count == 0 || self.wet == 0.0 {
            self.swap();
        } else {
            self.fade = Fade::Out;
        }
    }

    fn swap(&mut self) {
        // Effects that leave the chain lose their state; ones that enter start clean.
        for kind in 0..KINDS as u8 {
            let was = self.order[..self.count].contains(&kind);
            let will = self.next[..self.next_count].contains(&kind);
            if was != will {
                self.reset_kind(kind);
            }
        }
        self.order = self.next;
        self.count = self.next_count;
        self.switch_at = None;
        self.quiet_frames = 0;
        self.fade = if self.count > 0 {
            Fade::In
        } else {
            Fade::Steady
        };
        if self.count == 0 {
            self.wet = 0.0;
        }
    }

    /// Processes `input` (the mid signal of the voices) and `side` (stereo voices only:
    /// left = mid + side, right = mid − side) into `left` and `right`. Returns the peak
    /// of the output. `frame` is the frame of the first sample.
    pub fn process(
        &mut self,
        input: &[f32],
        side: Option<&[f32]>,
        left: &mut [f32],
        right: &mut [f32],
        params: &ParamBank,
        frame: f64,
    ) -> f32 {
        self.apply_due(frame);
        let p = |position: usize| params.get(EFFECT_BASE + position);
        let lowpass = (p(position::LOWPASS), p(position::LOWPASS_Q));
        let highpass = (p(position::HIGHPASS), p(position::HIGHPASS_Q));
        let (distort_amount, crush_amount) = (p(position::DISTORT), p(position::CRUSH));
        let chorus = (p(position::CHORUS), p(position::CHORUS_RATE));
        let phaser = (p(position::PHASER), p(position::PHASER_RATE));
        let (comp_amount, gate_amount) = (p(position::COMP), p(position::GATE));
        if self.order[..self.count].contains(&EQ) {
            self.eq.prepare(
                p(position::EQ_LOW).start,
                p(position::EQ_MID).start,
                p(position::EQ_MID_FREQ).start,
                p(position::EQ_HIGH).start,
                self.sample_rate,
            );
        }
        let mut peak = 0.0_f32;
        for n in 0..input.len() {
            let dry = match side {
                None => [input[n], input[n]],
                Some(side) => [input[n] + side[n], input[n] - side[n]],
            };
            let mut x = dry;
            for &kind in &self.order[..self.count] {
                x = match kind {
                    LOWPASS => {
                        self.lowpass
                            .lowpass(x, lowpass.0.at(n), lowpass.1.at(n), self.sample_rate)
                    }
                    HIGHPASS => self.highpass.highpass(
                        x,
                        highpass.0.at(n),
                        highpass.1.at(n),
                        self.sample_rate,
                    ),
                    DISTORT => distort(x, distort_amount.at(n)),
                    CRUSH => self.crush.process(x, crush_amount.at(n)),
                    CHORUS => self.chorus.process(x, chorus.0.at(n), chorus.1.at(n)),
                    PHASER => {
                        self.phaser
                            .process(x, phaser.0.at(n), phaser.1.at(n), self.sample_rate)
                    }
                    EQ => self.eq.process(x),
                    COMP => self.comp.process(x, comp_amount.at(n)),
                    GATE => self.gate.process(x, gate_amount.at(n)),
                    _ => x,
                };
            }
            self.advance_fade();
            let wet = self.wet;
            let l = dry[0] + wet * (x[0] - dry[0]);
            let r = dry[1] + wet * (x[1] - dry[1]);
            left[n] = l;
            right[n] = r;
            peak = peak.max(l.abs()).max(r.abs());
        }
        if peak < SILENCE {
            self.quiet_frames = self.quiet_frames.saturating_add(input.len() as u32);
        } else {
            self.quiet_frames = 0;
        }
        peak
    }

    #[inline]
    fn advance_fade(&mut self) {
        match self.fade {
            Fade::Steady => {}
            Fade::In => {
                self.wet = (self.wet + self.fade_step).min(1.0);
                if self.wet >= 1.0 {
                    self.fade = Fade::Steady;
                }
            }
            Fade::Out => {
                self.wet = (self.wet - self.fade_step).max(0.0);
                if self.wet <= 0.0 {
                    self.fade = Fade::Steady;
                    self.swap();
                }
            }
        }
    }

    fn reset_kind(&mut self, kind: u8) {
        match kind {
            LOWPASS => self.lowpass.reset(),
            HIGHPASS => self.highpass.reset(),
            CRUSH => self.crush.reset(),
            CHORUS => self.chorus.reset(),
            PHASER => self.phaser.reset(),
            EQ => self.eq.reset(),
            COMP => self.comp.reset(),
            GATE => self.gate.reset(),
            _ => {}
        }
    }

    /// Clears every effect state in place (stop, NaN, end of a retiring slot); the
    /// order, which is the text's, stays.
    pub fn reset(&mut self) {
        for kind in 0..KINDS as u8 {
            self.reset_kind(kind);
        }
        self.quiet_frames = 0;
        if self.switch_at.is_none() && self.fade == Fade::Out {
            self.fade = Fade::Steady;
        }
        self.wet = if self.count > 0 { 1.0 } else { 0.0 };
        if self.fade == Fade::In {
            self.fade = Fade::Steady;
        }
    }
}
