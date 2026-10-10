// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `lead`: two oscillators of the chosen `wave`, slightly detuned, through a
//! 12 dB filter; glides and plays legato. Resonance, filter envelope, decay, sustain,
//! pulse width and vibrato are parameters, so each style can have its own lead.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).

use crate::engines::env::AdsrTimes;
use crate::engines::va::{VaControls, VaCore, VaPatch, VaShape, VaShapeParams, Wave};
use crate::voice::{Params, Voice};

const PATCH: VaPatch = VaPatch {
    oscillators: 2,
    detune_spread: 0.2,
    envelope_octaves: 1.0,
    envelope_decay: 0.6,
    key_tracking: 0.5,
    level: 0.41,
    // Analog wander and voice cards.
    drift_cents: 3.0,
    card_cents: 2.5,
    card_cutoff_octaves: 0.06,
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
    vibrato: Some(super::VIBRATO),
    ..VaShapeParams::NONE
};

fn controls(params: &Params) -> VaControls {
    VaControls {
        cutoff: params.at(super::CUTOFF, 0),
        cutoff_step: params.step[super::CUTOFF],
        resonance: params.at(super::RESONANCE, 0),
        detune: params.at(super::DETUNE, 0),
        wave: Wave::from_index(params.choice(super::WAVE, super::WAVE_CHOICES)),
        width: params.at(super::WIDTH, 0),
        times: AdsrTimes { attack: params.at(super::ATTACK, 0), decay: params.at(super::DECAY, 0), sustain: params.at(super::SUSTAIN, 0), release: params.at(super::RELEASE, 0) },
        contour: params.at(super::CONTOUR, 0),
        accent: 0.0,
        tremolo: 0.0,
        gain: params.at(super::LEVEL, 0),
        shape: SHAPE.read(params, VaShape::NEUTRAL),
    }
}

pub struct LeadVoice {
    core: VaCore,
}

impl Voice for LeadVoice {
    fn new(sample_rate: f32) -> Self {
        LeadVoice { core: VaCore::new(sample_rate, PATCH) }
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
