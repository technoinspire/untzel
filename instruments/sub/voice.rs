// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `sub`: a sine or a triangle, pure low end, lightly filtered.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).

use crate::engines::env::AdsrTimes;
use crate::engines::va::{VaControls, VaCore, VaPatch, VaShape, VaShapeParams, Wave};
use crate::voice::{Params, Voice};

const PATCH: VaPatch = VaPatch {
    oscillators: 1,
    envelope_octaves: 0.0,
    level: 0.2908,
    // Analog wander and voice cards.
    drift_cents: 1.0,
    card_cents: 0.5,
    card_cutoff_octaves: 0.0,
    ..VaPatch::DEFAULT
};

/// The sound-design parameters this instrument exposes.
const SHAPE: VaShapeParams = VaShapeParams {
    drive: Some(super::DRIVE),
    ..VaShapeParams::NONE
};

fn controls(params: &Params) -> VaControls {
    let wave = if params.choice(super::WAVE, super::WAVE_CHOICES) == 0 { Wave::Triangle } else { Wave::Sine };
    VaControls {
        cutoff: params.at(super::CUTOFF, 0),
        cutoff_step: params.step[super::CUTOFF],
        resonance: 0.0,
        detune: 0.0,
        wave,
        width: 0.5,
        times: AdsrTimes { attack: params.at(super::ATTACK, 0), decay: 1.0, sustain: 1.0, release: params.at(super::RELEASE, 0) },
        contour: 0.0,
        accent: 0.0,
        tremolo: 0.0,
        gain: 1.0,
        shape: SHAPE.read(params, VaShape::NEUTRAL),
    }
}

pub struct SubVoice {
    core: VaCore,
}

impl Voice for SubVoice {
    fn new(sample_rate: f32) -> Self {
        SubVoice { core: VaCore::new(sample_rate, PATCH) }
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
