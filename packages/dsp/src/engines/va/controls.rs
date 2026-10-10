// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! What an instrument tells the virtual analog core: its constant `VaPatch`, and the
//! per-block `VaControls` with the sound-design `VaShape`. `VaShape::NEUTRAL`
//! is the voice as it was before the sound-design controls, sample for sample, so every new parameter
//! defaults to the old constant.

use super::oscillator::Wave;
use crate::engines::env::AdsrTimes;
use crate::voice::Params;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FilterKind {
    /// 12 dB state-variable low-pass.
    Svf12,
    /// 24 dB ladder low-pass with compensated, soft-clipped feedback.
    Ladder24,
}

/// The `filter` choice (`lp12`, `lp24`, `bp`, `hp`); band and high come from the SVF.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FilterMode {
    Lowpass12,
    Lowpass24,
    Bandpass,
    Highpass,
}

impl FilterMode {
    pub fn from_index(index: usize) -> FilterMode {
        match index {
            1 => FilterMode::Lowpass24,
            2 => FilterMode::Bandpass,
            3 => FilterMode::Highpass,
            _ => FilterMode::Lowpass12,
        }
    }

    pub fn of(kind: FilterKind) -> FilterMode {
        match kind {
            FilterKind::Svf12 => FilterMode::Lowpass12,
            FilterKind::Ladder24 => FilterMode::Lowpass24,
        }
    }
}

/// Constant character of an instrument.
#[derive(Clone, Copy, Debug)]
pub struct VaPatch {
    /// Oscillators in the detune fan, 1..=7.
    pub oscillators: usize,
    /// Widest detune of the fan at `detune` = 1, semitones.
    pub detune_spread: f32,
    /// Sub oscillator one octave down (sine), level 0..1.
    pub sub: f32,
    /// White noise level 0..1 (breath, air).
    pub noise: f32,
    pub filter: FilterKind,
    /// The filter envelope opens the cutoff up to this many octaves at `contour` 1.
    pub envelope_octaves: f32,
    /// Filter envelope decay as a fraction of the amplitude decay.
    pub envelope_decay: f32,
    /// Cutoff follows the note: 0 none, 1 one octave per octave.
    pub key_tracking: f32,
    /// Output level before the slot gain.
    pub level: f32,
    /// Slow random pitch walk of each oscillator, cents at its widest.
    pub drift_cents: f32,
    /// A steady counter-drift at 0.31 Hz: the outer oscillators of the fan move apart
    /// and back, cents at the edge (the reese's beating).
    pub counter_drift_cents: f32,
    /// Static pitch offset each new note draws per oscillator, cents at its widest (the
    /// voice card of an analog polysynth).
    pub card_cents: f32,
    /// Static cutoff offset each new note draws, octaves at its widest.
    pub card_cutoff_octaves: f32,
}

impl VaPatch {
    pub const DEFAULT: VaPatch = VaPatch {
        oscillators: 1,
        detune_spread: 0.3,
        sub: 0.0,
        noise: 0.0,
        filter: FilterKind::Svf12,
        envelope_octaves: 3.0,
        envelope_decay: 0.5,
        key_tracking: 0.0,
        level: 0.5,
        drift_cents: 0.0,
        counter_drift_cents: 0.0,
        card_cents: 0.0,
        card_cutoff_octaves: 0.0,
    };
}

/// The sound-design controls. Every field at its NEUTRAL
/// value leaves the voice as it was.
#[derive(Clone, Copy, Debug)]
pub struct VaShape {
    /// Second wave of every fan oscillator, crossfaded by `mix` (0 = `wave` only).
    pub wave2: Wave,
    pub mix: f32,
    /// Hard sync of the second wave: its pitch rises to 4× at 1 while it restarts with
    /// the first (0 = free running, no sync).
    pub sync: f32,
    /// None: the patch's filter.
    pub filter: Option<FilterMode>,
    /// Rise of the filter envelope, seconds (at most 1 ms is the instant rise of old).
    pub filter_attack: f32,
    /// Fall of the filter envelope, seconds; None follows the amplitude decay.
    pub filter_decay: Option<f32>,
    /// Saturation before the filter, 0..1.
    pub drive: f32,
    /// Stereo width of the fan: oscillators alternate left and right, and start at a
    /// random phase (0 = mono).
    pub spread: f32,
    /// None: the patch's sub and noise levels.
    pub sub: Option<f32>,
    pub noise: Option<f32>,
    /// Pitch scoop into the note (brass): −50 cents at 1, gone in about 60 ms.
    pub scoop: f32,
    /// Delayed vibrato (strings): a quarter semitone at 1, after 0.3 s.
    pub vibrato: f32,
    /// High-pass under the fundamental (supersaw), 0..1 of 0.9 × f0.
    pub low_cut: f32,
}

impl VaShape {
    pub const NEUTRAL: VaShape = VaShape {
        wave2: Wave::Saw,
        mix: 0.0,
        sync: 0.0,
        filter: None,
        filter_attack: 0.0,
        filter_decay: None,
        drive: 0.0,
        spread: 0.0,
        sub: None,
        noise: None,
        scoop: 0.0,
        vibrato: 0.0,
        low_cut: 0.0,
    };
}

/// Which manifest parameter (generated index) drives each `VaShape` field; None keeps
/// the instrument's base value.
#[derive(Clone, Copy)]
pub struct VaShapeParams {
    pub wave2: Option<usize>,
    pub mix: Option<usize>,
    pub sync: Option<usize>,
    pub filter: Option<usize>,
    pub filter_attack: Option<usize>,
    pub filter_decay: Option<usize>,
    pub drive: Option<usize>,
    pub spread: Option<usize>,
    pub sub: Option<usize>,
    pub noise: Option<usize>,
    pub scoop: Option<usize>,
    pub vibrato: Option<usize>,
    pub low_cut: Option<usize>,
}

impl VaShapeParams {
    pub const NONE: VaShapeParams = VaShapeParams {
        wave2: None,
        mix: None,
        sync: None,
        filter: None,
        filter_attack: None,
        filter_decay: None,
        drive: None,
        spread: None,
        sub: None,
        noise: None,
        scoop: None,
        vibrato: None,
        low_cut: None,
    };

    /// `base` with every mapped field read from `params` (the block's first sample).
    pub fn read(&self, params: &Params, base: VaShape) -> VaShape {
        let value =
            |index: Option<usize>, fallback: f32| index.map_or(fallback, |i| params.at(i, 0));
        let optional = |index: Option<usize>, fallback: Option<f32>| {
            index.map(|i| params.at(i, 0)).or(fallback)
        };
        VaShape {
            wave2: self
                .wave2
                .map_or(base.wave2, |i| Wave::from_index(params.choice(i, 4))),
            mix: value(self.mix, base.mix),
            sync: value(self.sync, base.sync),
            filter: self
                .filter
                .map(|i| FilterMode::from_index(params.choice(i, 4)))
                .or(base.filter),
            filter_attack: value(self.filter_attack, base.filter_attack),
            filter_decay: optional(self.filter_decay, base.filter_decay),
            drive: value(self.drive, base.drive),
            spread: value(self.spread, base.spread),
            sub: optional(self.sub, base.sub),
            noise: optional(self.noise, base.noise),
            scoop: value(self.scoop, base.scoop),
            vibrato: value(self.vibrato, base.vibrato),
            low_cut: value(self.low_cut, base.low_cut),
        }
    }
}

/// Per-block controls in parameter units.
#[derive(Clone, Copy, Debug)]
pub struct VaControls {
    /// Cutoff at the first sample (Hz) and its change per sample.
    pub cutoff: f32,
    pub cutoff_step: f32,
    pub resonance: f32,
    pub detune: f32,
    pub wave: Wave,
    /// Pulse width 0..1 (0.5 square).
    pub width: f32,
    pub times: AdsrTimes,
    /// Filter envelope amount 0..1.
    pub contour: f32,
    /// `acid`: an accented note opens the filter by this much more and decays faster.
    pub accent: f32,
    /// Amplitude tremolo depth 0..1 at about 6 Hz (bowed strings).
    pub tremolo: f32,
    /// Output gain on top of the patch level, for a wave or sound that is louder than
    /// the others of the same instrument (the sounds of one instrument stay close in level).
    pub gain: f32,
    pub shape: VaShape,
}
