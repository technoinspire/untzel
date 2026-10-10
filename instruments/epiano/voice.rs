// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
//! Voice of `epiano`: two FM stacks, a soft body and a short metallic tine on top
//! (ratio 14, about 30 ms at the default `decay`; `tine` sets its level),
//! brighter with velocity. `tremolo` pans the voice left and right at 4.5 Hz,
//! the suitcase autopan.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).
use crate::engines::env::AdsrTimes;
use crate::engines::fm::{FmControls, FmCore, FmPatch, Operator};
use crate::engines::limit;
use crate::math::{advance_phase, sine};
use crate::voice::{MAX_RENDER_FRAMES, Params, Voice};

const PATCH: FmPatch = FmPatch {
    algorithm: 1,
    operators: [
        Operator { ratio: 1.0, offset_hz: 0.0, level: 1.0, decay: 1.0, sustain: 1.0 },
        Operator { ratio: 1.0, offset_hz: 0.0, level: 1.3, decay: 0.4, sustain: 0.12 },
        Operator { ratio: 1.0, offset_hz: 0.0, level: 0.7, decay: 1.0, sustain: 1.0 },
        Operator { ratio: 14.0, offset_hz: 0.0, level: 0.55, decay: 0.015, sustain: 0.0 },
    ],
    feedback_depth: 0.2,
    velocity_brightness: 0.9,
    level: 0.282,
};
const AUTOPAN_HZ: f32 = 4.5;

fn controls(params: &Params) -> FmControls {
    // `tine` 0.5 is the patch level; 1 doubles it.
    let tine = 2.0 * params.at(super::TINE, 0);
    FmControls {
        brightness: params.at(super::BRIGHTNESS, 0),
        feedback: 0.0,
        detune: params.at(super::DETUNE, 0),
        times: AdsrTimes { attack: 0.002, decay: params.at(super::DECAY, 0), sustain: 0.0, release: params.at(super::RELEASE, 0) },
        operator_levels: [1.0, 1.0, 1.0, tine],
    }
}

pub struct EpianoVoice {
    sample_rate: f32,
    core: FmCore,
    pan_phase: f32,
}

impl Voice for EpianoVoice {
    fn new(sample_rate: f32) -> Self {
        EpianoVoice { sample_rate, core: FmCore::new(sample_rate, PATCH), pan_phase: 0.0 }
    }

    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        self.core.trigger(note, velocity, duration_frames, &controls(params));
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        self.core.render(out, &controls(params))
    }

    fn render_mid_side(&mut self, out: &mut [f32], side: &mut [f32], params: &Params) -> bool {
        let depth = params.at(super::TREMOLO, 0);
        if depth <= 0.0 {
            return self.core.render(out, &controls(params));
        }
        let len = out.len().min(MAX_RENDER_FRAMES);
        let mut voice = [0.0_f32; MAX_RENDER_FRAMES];
        let sounding = self.core.render(&mut voice[..len], &controls(params));
        let increment = AUTOPAN_HZ / self.sample_rate;
        for n in 0..len {
            self.pan_phase = advance_phase(self.pan_phase, increment);
            out[n] += voice[n];
            side[n] += limit(voice[n] * depth * sine(self.pan_phase));
        }
        sounding
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
