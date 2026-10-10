// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `harp`: two plucked strings per note, slightly detuned (`detune`), for a
//! shimmering harp.
//! The delay lines are allocated in `new`; `reset` zeroes them in place, so the audio thread never allocates.

use crate::engines::string::{Body, KarplusString, StringControls, note_hz};
use crate::engines::env::AdsrTimes;
use crate::engines::sampler::{Recorded, SamplePack, SamplerControls, SamplerPatch};
use crate::voice::{Params, Voice};

const STRINGS: usize = 2;
const LEVEL: f32 = 0.809;

fn controls(params: &Params) -> StringControls {
    StringControls {
        brightness: params.at(super::BRIGHTNESS, 0),
        decay: params.at(super::DECAY, 0),
        position: params.at(super::POSITION, 0),
        body: 0.25,
        release: params.at(super::RELEASE, 0),
    }
}

pub struct HarpVoice {
    /// The recorded instrument, when `source` is `samples` and the pack is there.
    recorded: Recorded,
    sample_rate: f32,
    strings: [KarplusString; STRINGS],
    body: Body,
    scratch: [f32; 128],
}


/// The recorded pack's voice; level fitted on pnpm sim --levels.
const RECORDED: SamplerPatch = SamplerPatch { vibrato: 0.0, vibrato_hz: 0.0, stem_detune_cents: 0.0, level: 0.639 };
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;

fn recorded_controls(params: &Params) -> SamplerControls {
    SamplerControls {
        vowel: 0.0,
        gain: params.at(super::LEVEL, 0),
        brightness: params.at(super::BRIGHTNESS, 0),
        detune: 0.0,
        times: AdsrTimes { attack: 0.001, decay: params.at(super::DECAY, 0), sustain: 0.0, release: params.at(super::RELEASE, 0) },
    }
}

impl HarpVoice {
    fn synth_steal(&mut self) {
        for string in self.strings.iter_mut() {
            string.steal();
        }
    }
    fn synth_render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let controls = controls(params);
        let len = out.len().min(self.scratch.len());
        let scratch = &mut self.scratch[..len];
        scratch.fill(0.0);
        let mut sounding = false;
        for string in self.strings.iter_mut() {
            sounding |= string.render(scratch, LEVEL / STRINGS as f32, &controls);
        }
        for (sample, &x) in out.iter_mut().zip(scratch.iter()) {
            *sample += self.body.process(x, controls.body, self.sample_rate, 180.0, 1_400.0);
        }
        sounding
    }
}

impl Voice for HarpVoice {
    fn new(sample_rate: f32) -> Self {
        HarpVoice {
            recorded: Recorded::new(sample_rate, RECORDED),
            sample_rate,
            strings: core::array::from_fn(|index| KarplusString::new(sample_rate, 0x6861_7270 + index as u32)),
            body: Body::default(),
            scratch: [0.0; 128],
        }
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
        if self.recorded.trigger(wanted, 0.0, note, velocity, duration_frames, &recorded_controls(params)) {
            self.synth_steal();
            return;
        }
        let controls = controls(params);
        let hz = note_hz(note);
        let detune = params.at(super::DETUNE, 0);
        for (index, string) in self.strings.iter_mut().enumerate() {
            let cents = if index == 0 { 0.0 } else { 4.0 + 10.0 * detune };
            string.pluck(hz * (cents / 1200.0 * core::f32::consts::LN_2).exp(), velocity, duration_frames, &controls);
        }
    }



    fn level(&self) -> f32 {
        (self.strings.iter().map(KarplusString::level).fold(0.0, f32::max)).max(self.recorded.level())
    }

    fn is_released(&self) -> bool {
        if self.recorded.is_sampled() { self.recorded.is_released() } else { self.strings[0].is_released() }
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.recorded.reset();
        for string in self.strings.iter_mut() {
            string.reset();
        }
        self.body.reset();
    }
}
