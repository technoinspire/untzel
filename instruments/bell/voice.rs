// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `bell`: two inharmonic FM stacks that ring long after the strike.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).

use crate::engines::env::AdsrTimes;
use crate::engines::fm::{FmControls, FmCore, FmPatch, Operator, PATCH_LEVELS};
use crate::engines::sampler::{Recorded, SamplePack, SamplerControls, SamplerPatch};
use crate::voice::{Params, Voice};

const PATCH: FmPatch = FmPatch {
    algorithm: 1,
    operators: [
        Operator { ratio: 1.0, offset_hz: 0.0, level: 1.0, decay: 1.0, sustain: 1.0 },
        Operator { ratio: 3.5, offset_hz: 0.0, level: 2.2, decay: 0.6, sustain: 0.15 },
        Operator { ratio: 2.76, offset_hz: 0.0, level: 0.5, decay: 1.0, sustain: 1.0 },
        Operator { ratio: 5.19, offset_hz: 1.3, level: 1.3, decay: 0.3, sustain: 0.05 },
    ],
    feedback_depth: 0.5,
    velocity_brightness: 0.5,
    level: 0.8335,
};

fn controls(params: &Params) -> FmControls {
    FmControls {
        brightness: params.at(super::BRIGHTNESS, 0),
        feedback: params.at(super::FEEDBACK, 0),
        detune: 0.0,
        times: AdsrTimes { attack: 0.001, decay: params.at(super::DECAY, 0), sustain: 0.0, release: params.at(super::RELEASE, 0) },
        operator_levels: PATCH_LEVELS,
    }
}

pub struct BellVoice {
    /// The recorded instrument, when `source` is `samples` and the pack is there.
    recorded: Recorded,
    core: FmCore,
}


/// The recorded pack's voice; level fitted on pnpm sim --levels.
const RECORDED: SamplerPatch = SamplerPatch { vibrato: 0.0, vibrato_hz: 0.0, stem_detune_cents: 0.0, level: 0.734 };
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;

fn recorded_controls(params: &Params) -> SamplerControls {
    SamplerControls {
        vowel: 0.0,
        gain: params.at(super::LEVEL, 0),
        brightness: 0.5 + 0.3 * (params.at(super::BRIGHTNESS, 0) - 0.5),
        detune: 0.0,
        times: AdsrTimes { attack: 0.001, decay: params.at(super::DECAY, 0), sustain: 0.0, release: params.at(super::RELEASE, 0) },
    }
}

impl BellVoice {
    fn synth_steal(&mut self) {
        self.core.steal();
    }
    fn synth_render(&mut self, out: &mut [f32], params: &Params) -> bool {
        self.core.render(out, &controls(params))
    }
}

impl Voice for BellVoice {
    fn new(sample_rate: f32) -> Self {
        BellVoice {
            recorded: Recorded::new(sample_rate, RECORDED), core: FmCore::new(sample_rate, PATCH) }
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let synth = self.synth_render(out, params);
        let recorded = self.recorded.render(out, &recorded_controls(params));
        synth || recorded
    }
    fn render_mid_side(&mut self, mid: &mut [f32], side: &mut [f32], params: &Params) -> bool {
        let synth = self.synth_render(mid, params);
        let recorded = self.recorded.render_mid_side(mid, side, &recorded_controls(params));
        synth || recorded
    }
    fn use_samples(&mut self, pack: Option<&'static SamplePack>) {
        self.recorded.set_pack(pack);
    }
    fn steal(&mut self) {
        self.synth_steal();
        self.recorded.steal();
    }
    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        let wanted = params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES;
        if self.recorded.trigger(wanted, if params.at(super::BRIGHTNESS, 0) >= 0.6 { 1.0 } else { 0.0 }, note, velocity, duration_frames, &recorded_controls(params)) {
            self.synth_steal();
            return;
        }
        self.core.trigger(note, velocity, duration_frames, &controls(params));
    }



    fn level(&self) -> f32 {
        (self.core.level()).max(self.recorded.level())
    }

    fn reset(&mut self, sample_rate: f32) {
        self.core = FmCore::new(sample_rate, PATCH);
        self.recorded.reset();
    }
    fn is_released(&self) -> bool {
        if self.recorded.is_sampled() { self.recorded.is_released() } else { self.core.is_released() }
    }
}
