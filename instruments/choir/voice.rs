// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `choir`, stereo. `source samples` plays the VocalSet ensemble pack:
//! 3 to 6 singers per zone in two stems, left and right of the spread, which `detune`
//! pulls apart; until the pack has arrived it sings on the formants. `source synth`:
//! three detuned voices per note through five vowel formants, centred; `vowel` moves
//! through a, e, i, o, u.

use crate::engines::env::AdsrTimes;
use crate::engines::formant::{FormantControls, FormantCore, FormantPatch};
use crate::engines::sampler::{SamplePack, SamplerControls, SamplerCore, SamplerPatch};
use crate::voice::{MAX_RENDER_FRAMES, Params, Voice};

const PATCH: FormantPatch = FormantPatch {
    sources: 3,
    detune_spread: 0.25,
    vibrato: 0.12,
    vibrato_hz: 5.2,
    level: 0.1825,
};

const SAMPLER: SamplerPatch = SamplerPatch {
    vibrato: 0.0,
    vibrato_hz: 0.0,
    stem_detune_cents: 12.0,
    level: 0.4,
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
        detune: params.at(super::DETUNE, 0),
        times: times(params),
    }
}

fn sampler_controls(params: &Params) -> SamplerControls {
    SamplerControls {
        vowel: params.at(super::VOWEL, 0),
        gain: 1.0,
        brightness: params.at(super::BRIGHTNESS, 0),
        detune: params.at(super::DETUNE, 0),
        times: times(params),
    }
}

pub struct ChoirVoice {
    core: FormantCore,
    sampler: SamplerCore,
    /// The current note plays the samples.
    sampled: bool,
}

impl Voice for ChoirVoice {
    const STEREO: bool = true;

    fn new(sample_rate: f32) -> Self {
        ChoirVoice {
            core: FormantCore::new(sample_rate, PATCH),
            sampler: SamplerCore::new(sample_rate, SAMPLER),
            sampled: false,
        }
    }

    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        self.sampled = params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES && self.sampler.has_pack();
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

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let formant = self.core.render(out, &controls(params));
        let sampled = self.sampler.render_mono(out, &sampler_controls(params));
        formant || sampled
    }

    fn render_stereo(&mut self, left: &mut [f32], right: &mut [f32], params: &Params) -> bool {
        let len = left.len().min(right.len()).min(MAX_RENDER_FRAMES);
        let mut centre = [0.0_f32; MAX_RENDER_FRAMES];
        // An idle formant core writes nothing: skip the copy (its last block still counts).
        let had_level = self.core.level() > 0.0;
        let formant = self.core.render(&mut centre[..len], &controls(params));
        if formant || had_level {
            for ((l, r), x) in left.iter_mut().zip(right.iter_mut()).zip(&centre[..len]) {
                *l += x;
                *r += x;
            }
        }
        let sampled = self.sampler.render_stereo(&mut left[..len], &mut right[..len], &sampler_controls(params));
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
