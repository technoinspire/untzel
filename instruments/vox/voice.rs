// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `vox`: one singing voice. `source synth` sings through five vowel formants,
//! with vibrato that grows after the attack; `source samples` plays a solo singer from
//! the VocalSet pack, and stays on the formants until the pack has arrived.
//! Glides and plays legato on both.

use crate::engines::env::AdsrTimes;
use crate::engines::formant::{FormantControls, FormantCore, FormantPatch};
use crate::engines::sampler::{SamplePack, SamplerControls, SamplerCore, SamplerPatch};
use crate::voice::{Params, Voice};

const PATCH: FormantPatch = FormantPatch {
    sources: 1,
    detune_spread: 0.0,
    vibrato: 0.25,
    vibrato_hz: 5.6,
    level: 0.09537,
};

const SAMPLER: SamplerPatch = SamplerPatch {
    vibrato: 0.18,
    vibrato_hz: 5.4,
    stem_detune_cents: 0.0,
    level: 0.53,
};

/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;

fn times(params: &Params) -> AdsrTimes {
    AdsrTimes {
        attack: params.at(super::ATTACK, 0),
        decay: 1.0,
        sustain: 1.0,
        release: params.at(super::RELEASE, 0),
    }
}

fn controls(params: &Params) -> FormantControls {
    FormantControls {
        vowel: params.at(super::VOWEL, 0),
        breath: params.at(super::BREATH, 0),
        brightness: params.at(super::BRIGHTNESS, 0),
        detune: 0.0,
        times: times(params),
    }
}

fn sampler_controls(params: &Params) -> SamplerControls {
    SamplerControls {
        vowel: params.at(super::VOWEL, 0),
        gain: 1.0,
        brightness: params.at(super::BRIGHTNESS, 0),
        detune: 0.0,
        times: times(params),
    }
}

pub struct VoxVoice {
    core: FormantCore,
    sampler: SamplerCore,
    /// The current note plays the samples.
    sampled: bool,
}

impl VoxVoice {
    fn wants_samples(&self, params: &Params) -> bool {
        params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES && self.sampler.has_pack()
    }

    /// Starts a note on the engine `source` asks for; the other one fades out in 2 ms.
    fn start(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        self.sampled = self.wants_samples(params);
        if self.sampled {
            if self.core.level() > 0.0 {
                self.core.steal();
            }
            self.sampler.trigger(note, velocity, duration_frames, &sampler_controls(params));
        } else {
            if self.sampler.is_active() {
                self.sampler.steal();
            }
            self.core.trigger(note, velocity, duration_frames, &controls(params));
        }
    }
}

impl Voice for VoxVoice {
    fn new(sample_rate: f32) -> Self {
        VoxVoice {
            core: FormantCore::new(sample_rate, PATCH),
            sampler: SamplerCore::new(sample_rate, SAMPLER),
            sampled: false,
        }
    }

    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        self.start(note, velocity, duration_frames, params);
    }

    fn legato(&mut self, note: f32, velocity: f32, duration_frames: u32, glide_frames: u32, retrigger: bool, params: &Params) {
        match (self.sampled, self.wants_samples(params)) {
            (true, true) => {
                self.sampler.legato(note, velocity, duration_frames, glide_frames, retrigger, &sampler_controls(params));
            }
            (false, false) => {
                self.core.legato(note, velocity, duration_frames, glide_frames, retrigger, &controls(params));
            }
            _ => self.start(note, velocity, duration_frames, params),
        }
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let formant = self.core.render(out, &controls(params));
        let sampled = self.sampler.render_mono(out, &sampler_controls(params));
        formant || sampled
    }

    fn use_samples(&mut self, pack: Option<&'static SamplePack>) {
        self.sampler.set_pack(pack);
    }

    fn steal(&mut self) {
        self.core.steal();
        self.sampler.steal();
    }

    fn level(&self) -> f32 {
        self.core.level().max(self.sampler.level())
    }

    fn is_released(&self) -> bool {
        if self.sampled {
            self.sampler.is_released()
        } else {
            self.core.is_released()
        }
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.core.reset();
        self.sampler.reset();
        self.sampled = false;
    }
}
