// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `fm-bass`: its own stack: a carrier under a modulator an
//! octave up (2 : 1) that decays fast, over a self-fed operator at the note, plucky and
//! growling to metallic.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).

use crate::engines::env::AdsrTimes;
use crate::engines::fm::{FmControls, FmCore, FmPatch, Operator, PATCH_LEVELS};
use crate::voice::{Params, Voice};

const PATCH: FmPatch = FmPatch {
    algorithm: 0,
    operators: [
        Operator { ratio: 1.0, offset_hz: 0.0, level: 1.0, decay: 1.0, sustain: 1.0 },
        Operator { ratio: 2.0, offset_hz: 0.0, level: 2.2, decay: 0.3, sustain: 0.15 },
        Operator { ratio: 1.0, offset_hz: 0.0, level: 0.9, decay: 0.5, sustain: 0.3 },
        Operator { ratio: 1.0, offset_hz: 0.0, level: 0.6, decay: 0.8, sustain: 0.4 },
    ],
    feedback_depth: 0.9,
    velocity_brightness: 0.6,
    level: 0.4798,
};

fn controls(params: &Params) -> FmControls {
    FmControls {
        brightness: params.at(super::BRIGHTNESS, 0),
        feedback: params.at(super::FEEDBACK, 0),
        detune: 0.0,
        times: AdsrTimes { attack: 0.002, decay: params.at(super::DECAY, 0), sustain: 0.35, release: params.at(super::RELEASE, 0) },
        operator_levels: PATCH_LEVELS,
    }
}

pub struct FmBassVoice {
    core: FmCore,
}

impl Voice for FmBassVoice {
    fn new(sample_rate: f32) -> Self {
        FmBassVoice { core: FmCore::new(sample_rate, PATCH) }
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
