// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
//! Voice of `kalimba`: a thumb piano. Each tine rings with its own stretched partials;
//! `body` brings up the box resonance near the octave, `hardness` the thumb (a short
//! contact whose spectrum is put on every mode), `brightness` the upper
//! partials and `noise` the buzz of the thumb on the tine.
use crate::engines::modal::{Exciter, ModalBank, Mode, shape_contact};
use crate::engines::played_note;
use crate::math::midi_to_hz;
use crate::engines::env::AdsrTimes;
use crate::engines::sampler::{Recorded, SamplePack, SamplerControls, SamplerPatch};
use crate::voice::{Params, Voice};

const MODES: usize = 6;
/// Tine partials (inharmonic) and, last two, the box modes near the octave and fifth.
const RATIOS: [f32; MODES] = [1.0, 5.93, 13.2, 21.5, 2.01, 3.02];
const GAINS: [f32; MODES] = [1.0, 0.7, 0.15, 0.06, 0.08, 0.05];
const LEVEL: f32 = 0.46;

pub struct KalimbaVoice {
    /// The recorded instrument, when `source` is `samples` and the pack is there.
    recorded: Recorded,
    bank: ModalBank<MODES>,
}


/// The recorded pack's voice; level fitted on pnpm sim --levels.
const RECORDED: SamplerPatch = SamplerPatch { vibrato: 0.0, vibrato_hz: 0.0, stem_detune_cents: 0.0, level: 0.754 };
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;

fn recorded_controls(params: &Params) -> SamplerControls {
    SamplerControls {
        vowel: 0.0,
        gain: params.at(super::LEVEL, 0),
        brightness: params.at(super::BRIGHTNESS, 0),
        detune: 0.0,
        times: AdsrTimes { attack: 0.001, decay: params.at(super::DECAY, 0), sustain: 0.0, release: 0.6 },
    }
}

impl KalimbaVoice {
    fn synth_steal(&mut self) {
        self.bank.steal();
    }
    fn synth_render(&mut self, out: &mut [f32], params: &Params) -> bool {
        // Bright tines carry more energy in the upper partials: this keeps them level
        // with the other sounds.
        let brightness = params.at(super::BRIGHTNESS, 0);
        self.bank.render(out, LEVEL / (1.0 + 1.2 * brightness * brightness))
    }
}

impl Voice for KalimbaVoice {
    fn new(sample_rate: f32) -> Self {
        KalimbaVoice {
            recorded: Recorded::new(sample_rate, RECORDED), bank: ModalBank::new(sample_rate, 0x6b61_6c69) }
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
        let f0 = midi_to_hz(played_note(note));
        let hardness = params.at(super::HARDNESS, 0);
        let brightness = params.at(super::BRIGHTNESS, 0);
        let decay = params.at(super::DECAY, 0);
        let body = params.at(super::BODY, 0);
        let mut modes = [Mode::default(); MODES];
        for (k, mode) in modes.iter_mut().enumerate() {
            let gain = match k {
                0 => 1.0,
                4 | 5 => GAINS[k] * (0.2 + 2.5 * body),
                _ => GAINS[k] * (0.1 + 3.0 * brightness * brightness),
            };
            let ring = if k >= 4 { 0.25 + 0.5 * body } else { 1.0 / (1.0 + 0.6 * k as f32) };
            *mode = Mode { hz: f0 * RATIOS[k], gain, decay: decay * ring };
        }
        let soft = 1.0 - hardness;
        let thumb_seconds = 0.0003 + 0.0027 * soft * soft;
        shape_contact(&mut modes, f0, thumb_seconds, hardness);
        let exciter = Exciter::Contact { seconds: thumb_seconds, noise: params.at(super::NOISE, 0) };
        self.bank.strike(&modes, exciter, velocity, 0.3 + 0.7 * hardness);
    }



    fn level(&self) -> f32 {
        (self.bank.peak()).max(self.recorded.level())
    }

    fn is_released(&self) -> bool {
        if self.recorded.is_sampled() { self.recorded.is_released() } else { true }
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.recorded.reset();
        self.bank.reset();
    }
}
