// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `supersaw`: seven saws spread wide, the anthem lead.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).

use crate::engines::env::AdsrTimes;
use crate::engines::va::{VaControls, VaCore, VaPatch, VaShape, VaShapeParams, Wave};
use crate::voice::{Params, Voice};

const PATCH: VaPatch = VaPatch {
    oscillators: 7,
    detune_spread: 0.45,
    envelope_octaves: 0.5,
    envelope_decay: 1.0,
    level: 0.164,
    // Analog wander and voice cards.
    drift_cents: 4.0,
    card_cents: 3.0,
    card_cutoff_octaves: 0.08,
    ..VaPatch::DEFAULT
};

/// The sound-design parameters this instrument exposes.
const SHAPE: VaShapeParams = VaShapeParams {
    wave2: Some(super::WAVE2),
    mix: Some(super::MIX),
    sync: Some(super::SYNC),
    filter: Some(super::FILTER),
    filter_attack: Some(super::FILTER_ATTACK),
    filter_decay: Some(super::FILTER_DECAY),
    drive: Some(super::DRIVE),
    spread: Some(super::SPREAD),
    sub: Some(super::SUB),
    noise: Some(super::NOISE),
    low_cut: Some(super::LOW_CUT),
    ..VaShapeParams::NONE
};

fn controls(params: &Params) -> VaControls {
    VaControls {
        cutoff: params.at(super::CUTOFF, 0),
        cutoff_step: params.step[super::CUTOFF],
        resonance: 0.1,
        detune: params.at(super::DETUNE, 0),
        wave: Wave::Saw,
        width: 0.5,
        times: AdsrTimes { attack: params.at(super::ATTACK, 0), decay: 1.0, sustain: 0.85, release: params.at(super::RELEASE, 0) },
        contour: 0.2,
        accent: 0.0,
        tremolo: 0.0,
        gain: 1.0,
        shape: SHAPE.read(params, VaShape::NEUTRAL),
    }
}

pub struct SupersawVoice {
    core: VaCore,
}

impl Voice for SupersawVoice {
    fn new(sample_rate: f32) -> Self {
        SupersawVoice { core: VaCore::new(sample_rate, PATCH) }
    }

    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        self.core.trigger(note, velocity, duration_frames, &controls(params));
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
