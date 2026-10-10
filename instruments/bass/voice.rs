// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of the `bass` instrument: a band-limited saw through a 2-pole low-pass, a
//! plucked amplitude envelope (`decay`), a short filter envelope and saturation.
//! Parameter indices: `super::<NAME>` (generated from manifest.json by
//! packages/dsp/build.rs).
//!
//! A new note keeps the oscillator phase and the filter state, and attacks from the
//! current level: a stolen or retriggered voice never clicks.

use crate::math::{
    SILENCE, Svf, advance_phase, decay_coefficient, filter_gain, midi_to_hz, poly_blep,
    saturate,
};
use crate::voice::{Params, Voice};

/// Midi note of a hit (`c2`), for a bass pattern written with `x`.
const HIT_NOTE: f32 = 36.0;
const ATTACK_SECONDS: f32 = 0.003;
const RELEASE_SECONDS: f32 = 0.030;
/// The filter envelope opens the cutoff up to `1 + FILTER_ENVELOPE` times.
const FILTER_ENVELOPE: f32 = 1.5;
const FILTER_DAMPING: f32 = 0.7;
const DRIVE_DEPTH: f32 = 8.0;
const LEVEL: f32 = 0.7;

pub struct BassVoice {
    sample_rate: f32,
    phase: f32,
    increment: f32,
    filter: Svf,
    level: f32,
    peak: f32,
    attack_step: f32,
    attack_left: u32,
    gate_left: u32,
    filter_envelope: f32,
    release: f32,
}

impl Voice for BassVoice {
    fn new(sample_rate: f32) -> Self {
        BassVoice {
            sample_rate,
            phase: 0.0,
            increment: 0.0,
            filter: Svf::default(),
            level: 0.0,
            peak: 0.0,
            attack_step: 0.0,
            attack_left: 0,
            gate_left: 0,
            filter_envelope: 0.0,
            release: decay_coefficient(RELEASE_SECONDS, sample_rate),
        }
    }

    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, _params: &Params) {
        let note = if note < 0.0 { HIT_NOTE } else { note };
        self.increment = (midi_to_hz(note) / self.sample_rate).min(0.45);
        self.peak = velocity;
        self.attack_left = ((ATTACK_SECONDS * self.sample_rate) as u32).max(1);
        self.attack_step = (velocity - self.level) / self.attack_left as f32;
        self.gate_left = duration_frames.max(self.attack_left);
        self.filter_envelope = velocity;
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let decay_seconds = params.at(super::DECAY, 0);
        let decay = decay_coefficient(decay_seconds, self.sample_rate);
        let filter_decay = decay_coefficient(decay_seconds * 0.5, self.sample_rate);
        for (n, sample) in out.iter_mut().enumerate() {
            self.phase = advance_phase(self.phase, self.increment);
            let saw = 2.0 * self.phase - 1.0 - poly_blep(self.phase, self.increment);
            let cutoff = params.at(super::CUTOFF, n) * (1.0 + FILTER_ENVELOPE * self.filter_envelope);
            let g = filter_gain(cutoff, self.sample_rate);
            let low = self.filter.process(saw, g, FILTER_DAMPING).low;
            let driven = saturate(low, params.at(super::DRIVE, n), DRIVE_DEPTH);
            *sample += driven * self.level * LEVEL;
            self.advance_envelopes(decay, filter_decay);
        }
        self.attack_left > 0 || self.level > SILENCE
    }
}

impl BassVoice {
    #[inline]
    fn advance_envelopes(&mut self, decay: f32, filter_decay: f32) {
        if self.attack_left > 0 {
            self.attack_left -= 1;
            self.level = if self.attack_left == 0 {
                self.peak
            } else {
                self.level + self.attack_step
            };
        } else if self.gate_left > 0 {
            self.level *= decay;
        } else {
            self.level *= self.release.min(decay);
        }
        self.gate_left = self.gate_left.saturating_sub(1);
        self.filter_envelope *= filter_decay;
    }
}
