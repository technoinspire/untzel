// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `reese`: two saws drifting against each other plus a sub, through a 24 dB
//! ladder: the rolling bass of drum and bass and deep house.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).

use crate::engines::env::AdsrTimes;
use crate::engines::va::{FilterKind, VaControls, VaCore, VaPatch, VaShape, VaShapeParams, Wave};
use crate::voice::{Params, Voice};

const PATCH: VaPatch = VaPatch {
    // Four saws in a 12 dB filter, the drift moving their phases.
    oscillators: 4,
    detune_spread: 0.35,
    filter: FilterKind::Svf12,
    envelope_octaves: 0.5,
    sub: 0.35,
    level: 0.43,
    // The counter-drift is the reese's own motion; a random wander or a voice card on top
    // blurs its beating into the plain detuned bass (the timbre check hears it).
    counter_drift_cents: 30.0,
    drift_cents: 0.0,
    card_cents: 0.0,
    card_cutoff_octaves: 0.0,
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
    ..VaShapeParams::NONE
};

fn controls(params: &Params) -> VaControls {
    VaControls {
        cutoff: params.at(super::CUTOFF, 0),
        cutoff_step: params.step[super::CUTOFF],
        resonance: params.at(super::RESONANCE, 0),
        detune: params.at(super::DETUNE, 0),
        wave: Wave::Saw,
        width: 0.5,
        times: AdsrTimes { attack: 0.004, decay: 1.0, sustain: 1.0, release: params.at(super::RELEASE, 0) },
        contour: 0.2,
        accent: 0.0,
        tremolo: 0.0,
        // The drive squashes the fan: this brings the reese back to the level of
        // its other sounds.
        gain: 1.45,
        shape: SHAPE.read(params, VaShape::NEUTRAL),
    }
}

pub struct ReeseVoice {
    core: VaCore,
}

impl Voice for ReeseVoice {
    fn new(sample_rate: f32) -> Self {
        ReeseVoice { core: VaCore::new(sample_rate, PATCH) }
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
