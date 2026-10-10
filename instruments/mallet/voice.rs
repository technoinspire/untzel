// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `mallet`: modes of a tuned bar, by `material`: `wood` is
//! the marimba (its strong fourth-octave partial), `metal` the vibraphone (1 : 3.9 : 9.2,
//! long ring, the motor's amplitude `tremolo` at 5 Hz) and `hollow` a short, dry bar
//! (1 : 3 : 6). `tune` stretches the upper partials; the mallet is a short contact whose
//! spectrum is put on every mode, `hardness` sets its length.

use crate::engines::modal::{Exciter, ModalBank, Mode, shape_contact};
use crate::engines::played_note;
use crate::math::{advance_phase, midi_to_hz, sine};
use crate::engines::env::AdsrTimes;
use crate::engines::sampler::{Recorded, SamplePack, SamplerControls, SamplerPatch};
use crate::voice::{Params, Voice};

const MODES: usize = 12;

/// Partial ratios, gains and how much faster each partial decays, per material.
struct Bar {
    ratios: [f32; MODES],
    gains: [f32; MODES],
    damping: f32,
    /// Output level of the material (a metal bar rings much longer, so it starts quieter).
    level: f32,
}

const MARIMBA: Bar = Bar {
    ratios: [1.0, 3.93, 9.97, 18.4, 29.1, 2.0, 4.0, 6.3, 12.6, 15.1, 22.5, 35.0],
    gains: [1.0, 0.6, 0.25, 0.1, 0.04, 0.06, 0.05, 0.04, 0.03, 0.02, 0.015, 0.01],
    damping: 0.6,
    level: 1.0,
};

const VIBRAPHONE: Bar = Bar {
    ratios: [1.0, 3.9, 9.2, 15.8, 24.1, 2.0, 5.1, 7.4, 12.3, 19.6, 28.4, 33.9],
    gains: [1.0, 0.5, 0.5, 0.3, 0.15, 0.03, 0.08, 0.1, 0.1, 0.06, 0.04, 0.03],
    damping: 0.2,
    level: 0.55,
};

const HOLLOW: Bar = Bar {
    ratios: [1.0, 3.0, 6.0, 9.9, 14.6, 2.0, 4.5, 7.6, 11.8, 17.3, 21.0, 26.5],
    gains: [1.0, 0.6, 0.35, 0.18, 0.08, 0.1, 0.1, 0.06, 0.05, 0.03, 0.02, 0.015],
    damping: 2.5,
    level: 1.0,
};

const LEVEL: f32 = 0.39;
/// Vibraphone motor speed.
const TREMOLO_HZ: f32 = 5.0;

pub struct MalletVoice {
    /// The recorded instrument, when `source` is `samples` and the pack is there.
    recorded: Recorded,
    sample_rate: f32,
    bank: ModalBank<MODES>,
    tremolo_phase: f32,
    level: f32,
}


/// The recorded pack's voice; level fitted on pnpm sim --levels.
const RECORDED: SamplerPatch = SamplerPatch { vibrato: 0.0, vibrato_hz: 0.0, stem_detune_cents: 0.0, level: 0.709 };
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;

fn recorded_controls(params: &Params) -> SamplerControls {
    SamplerControls {
        vowel: 0.0,
        gain: params.at(super::LEVEL, 0),
        brightness: params.at(super::BRIGHTNESS, 0),
        detune: 0.0,
        times: AdsrTimes { attack: 0.001, decay: params.at(super::DECAY, 0), sustain: 0.0, release: if params.choice(super::MATERIAL, 3) == 1 { 3.0 } else { 0.8 } },
    }
}

impl MalletVoice {
    fn synth_steal(&mut self) {
        self.bank.steal();
    }
    fn synth_render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let depth = params.at(super::TREMOLO, 0).clamp(0.0, 1.0);
        if depth <= 0.0 {
            return self.bank.render(out, self.level);
        }
        let mut voice = [0.0_f32; 128];
        let len = out.len().min(voice.len());
        let sounding = self.bank.render(&mut voice[..len], self.level);
        let increment = TREMOLO_HZ / self.sample_rate;
        for (sample, &x) in out.iter_mut().zip(&voice[..len]) {
            self.tremolo_phase = advance_phase(self.tremolo_phase, increment);
            *sample += x * (1.0 - depth * 0.5 * (1.0 + sine(self.tremolo_phase)));
        }
        sounding
    }
}

impl Voice for MalletVoice {
    fn new(sample_rate: f32) -> Self {
        MalletVoice {
            recorded: Recorded::new(sample_rate, RECORDED), sample_rate, bank: ModalBank::new(sample_rate, 0x6d61_6c6c), tremolo_phase: 0.0, level: LEVEL }
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
        if self.recorded.trigger(wanted, if params.choice(super::MATERIAL, 3) == 1 { 1.0 } else { 0.0 }, note, velocity, duration_frames, &recorded_controls(params)) {
            self.synth_steal();
            return;
        }
        let f0 = midi_to_hz(played_note(note));
        let hardness = params.at(super::HARDNESS, 0);
        let brightness = params.at(super::BRIGHTNESS, 0);
        let decay = params.at(super::DECAY, 0);
        let stretch = 0.9 + 0.2 * params.at(super::TUNE, 0);
        let bar = match params.choice(super::MATERIAL, 3) {
            1 => &VIBRAPHONE,
            2 => &HOLLOW,
            _ => &MARIMBA,
        };
        let mut modes = [Mode::default(); MODES];
        for (k, mode) in modes.iter_mut().enumerate() {
            let ratio = if k == 0 { 1.0 } else { bar.ratios[k] * stretch };
            let gain = bar.gains[k] * if k == 0 { 1.0 } else { 0.3 + 1.4 * brightness };
            *mode = Mode { hz: f0 * ratio, gain, decay: decay / (1.0 + bar.damping * k as f32) };
        }
        let soft = 1.0 - hardness;
        let contact = 0.0003 + 0.0027 * soft * soft;
        shape_contact(&mut modes, f0, contact, hardness);
        self.bank.strike(&modes, Exciter::Contact { seconds: contact, noise: 0.0 }, velocity, 0.2 + 0.8 * hardness);
        self.tremolo_phase = 0.0;
        self.level = LEVEL * bar.level;
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
        self.tremolo_phase = 0.0;
    }
}
