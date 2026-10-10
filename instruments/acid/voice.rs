// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `acid`: one saw or square through a resonant 24 dB ladder, a snappy filter
//! envelope and accents (velocity 1: `X` or `!`) that open the filter further.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).

use crate::engines::env::AdsrTimes;
use crate::engines::va::{FilterKind, VaControls, VaCore, VaPatch, VaShape, VaShapeParams, Wave};
use crate::voice::{Params, Voice};

const PATCH: VaPatch = VaPatch {
    oscillators: 1,
    filter: FilterKind::Ladder24,
    envelope_octaves: 2.5,
    envelope_decay: 0.8,
    key_tracking: 0.3,
    level: 0.62,
    // Analog wander and voice cards.
    drift_cents: 2.0,
    card_cents: 1.5,
    card_cutoff_octaves: 0.05,
    ..VaPatch::DEFAULT
};

/// The sound-design parameters this instrument exposes.
const SHAPE: VaShapeParams = VaShapeParams {
    wave2: Some(super::WAVE2),
    mix: Some(super::MIX),
    sync: Some(super::SYNC),
    filter: Some(super::FILTER),
    filter_attack: Some(super::FILTER_ATTACK),
    drive: Some(super::DRIVE),
    spread: Some(super::SPREAD),
    sub: Some(super::SUB),
    noise: Some(super::NOISE),
    ..VaShapeParams::NONE
};

fn controls(params: &Params) -> VaControls {
    let wave = if params.choice(super::WAVE, super::WAVE_CHOICES) == 1 { Wave::Square } else { Wave::Saw };
    VaControls {
        cutoff: params.at(super::CUTOFF, 0),
        cutoff_step: params.step[super::CUTOFF],
        resonance: params.at(super::RESONANCE, 0),
        detune: 0.0,
        wave,
        width: 0.5,
        times: AdsrTimes { attack: 0.002, decay: params.at(super::DECAY, 0) * 3.0, sustain: 0.0, release: 0.02 },
        contour: 0.6,
        accent: params.at(super::ACCENT, 0),
        tremolo: 0.0,
        gain: 1.0,
        shape: SHAPE.read(params, VaShape::NEUTRAL),
    }
}

pub struct AcidVoice {
    core: VaCore,
}

impl Voice for AcidVoice {
    fn new(sample_rate: f32) -> Self {
        AcidVoice { core: VaCore::new(sample_rate, PATCH) }
    }

    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        self.core.trigger(note, velocity, duration_frames, &controls(params));
    }

    fn legato(&mut self, note: f32, velocity: f32, duration_frames: u32, glide_frames: u32, retrigger: bool, params: &Params) {
        self.core.legato(note, velocity, duration_frames, glide_frames, retrigger, &controls(params));
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        self.core.render(out, &controls(params))
    }

    fn render_mid_side(&mut self, out: &mut [f32], side: &mut [f32], params: &Params) -> bool {
        self.core.render_mid_side(out, Some(side), &controls(params))
    }

    fn steal(&mut self) {
        self.core.steal();
    }

    fn level(&self) -> f32 {
        self.core.level()
    }

    fn is_released(&self) -> bool {
        self.core.is_released()
    }
}
