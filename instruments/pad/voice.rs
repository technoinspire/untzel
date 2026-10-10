// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `pad`: three detuned saws through a 12 dB filter with slow envelopes;
//! `brightness` sets the filter.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).

use crate::engines::env::AdsrTimes;
use crate::engines::va::{VaControls, VaCore, VaPatch, VaShape, VaShapeParams, Wave};
use crate::voice::{Params, Voice};

const PATCH: VaPatch = VaPatch {
    oscillators: 3,
    detune_spread: 0.3,
    envelope_octaves: 0.6,
    envelope_decay: 2.0,
    level: 0.234,
    // Analog wander and voice cards.
    drift_cents: 6.0,
    card_cents: 4.0,
    card_cutoff_octaves: 0.12,
    ..VaPatch::DEFAULT
};

/// Brightness 0..1 to a cutoff of 150 Hz .. 19 kHz.
fn brightness_cutoff(brightness: f32) -> f32 {
    150.0 * (7.0 * brightness.clamp(0.0, 1.0)).exp2()
}

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
    ..VaShapeParams::NONE
};

fn controls(params: &Params) -> VaControls {
    VaControls {
        cutoff: brightness_cutoff(params.at(super::BRIGHTNESS, 0)),
        cutoff_step: 0.0,
        resonance: params.at(super::RESONANCE, 0),
        detune: params.at(super::DETUNE, 0),
        wave: Wave::Saw,
        width: 0.5,
        times: AdsrTimes { attack: params.at(super::ATTACK, 0), decay: params.at(super::DECAY, 0), sustain: params.at(super::SUSTAIN, 0), release: params.at(super::RELEASE, 0) },
        contour: params.at(super::CONTOUR, 0),
        accent: 0.0,
        tremolo: 0.0,
        gain: params.at(super::LEVEL, 0),
        shape: SHAPE.read(params, VaShape::NEUTRAL),
    }
}

pub struct PadVoice {
    core: VaCore,
}

impl Voice for PadVoice {
    fn new(sample_rate: f32) -> Self {
        PadVoice { core: VaCore::new(sample_rate, PATCH) }
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
