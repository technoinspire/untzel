// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `conga`: a hand drum: membrane modes, a hand slap (`hardness`) and a small
//! pitch bend.

//! Recorded (VCSL CC0): C3 tumba, G3 conga and D4 quinto, `tune` between them; `slap` crossfades the open tone into the slap.
use crate::engines::modal::{Exciter, ModalBank, Mode, hammer_response, slap};
use crate::engines::sampler::{Hit, RecordedHit, SamplePack};
use crate::voice::{Params, Voice};

const RATIOS: [f32; 8] = [1.0, 1.52, 2.03, 2.48, 2.97, 3.44, 4.05, 4.6];
const GAINS: [f32; 8] = [1.0, 0.45, 0.3, 0.2, 0.14, 0.1, 0.07, 0.05];
/// Lowest fundamental (tune 0) and the octaves `tune` spans.
const LOW_HZ: f32 = 160.0;
const TUNE_OCTAVES: f32 = 1.6;
const LEVEL: f32 = 0.481;
/// A slap rings every mode from a hard contact: its peak is far above the struck tone.
const SLAP_LEVEL: f32 = 0.48;

/// The recording's level, fitted on pnpm sim --levels against the synthesis.
const RECORDED_LEVEL: f32 = 0.89;
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;
pub struct CongaVoice {
    /// The recorded hit, when `source` is `samples` and the pack is there.
    recorded: RecordedHit,
    sample_rate: f32,
    bank: ModalBank<8>,
    /// Pitch ratio above the resting pitch, falling to 1 (the bend).
    bend: f32,
    bend_coefficient: f32,
    bending: bool,
    /// 1 ÷ the hammer response at the struck fundamental (every sound of the drum
    /// peaks alike, whatever the stick and the size).
    compensation: f32,
}

impl CongaVoice {
    fn render_synth(&mut self, out: &mut [f32], _params: &Params) -> bool {
        if self.bending {
            self.bend = 1.0 + (self.bend - 1.0) * self.bend_coefficient.powi(out.len() as i32);
            self.bank.retune(self.bend);
            self.bending = self.bend > 1.001;
        }
        self.bank.render(out, LEVEL * self.compensation)
    }
}
impl Voice for CongaVoice {
    fn new(sample_rate: f32) -> Self {
        CongaVoice { recorded: RecordedHit::new(sample_rate, RECORDED_LEVEL), sample_rate, bank: ModalBank::new(sample_rate, 0x636f_6e67), bend: 1.0, bend_coefficient: 1.0, bending: false, compensation: 1.0 }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        let hit = Hit { position: params.at(super::SLAP, 0), note: 48.0 + 14.0 * params.at(super::TUNE, 0), velocity, decay: params.at(super::DECAY, 0), brightness: params.at(super::HARDNESS, 0) };
        if self.recorded.trigger(params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES, hit, duration_frames) {
            self.bank.steal();
            return;
        }
        let base = LOW_HZ * (TUNE_OCTAVES * params.at(super::TUNE, 0)).exp2();
        let decay = params.at(super::DECAY, 0);
        let hardness = params.at(super::HARDNESS, 0);
        let mut modes = [Mode::default(); 8];
        for (k, mode) in modes.iter_mut().enumerate() {
            let gain = GAINS[k] * if k == 0 { 1.0 } else { 0.4 + 0.9 * hardness };
            *mode = Mode { hz: base * RATIOS[k], gain, decay: decay / (1.0 + 0.8 * k as f32) };
        }
        let bend = params.at(super::BEND, 0);
        self.bend = 1.0 + bend;
        self.bend_coefficient = (-1.0 / ((0.02 + 0.25 * decay) * self.sample_rate)).exp();
        self.bending = bend > 0.0;
        // The struck pitch is the bent one; retune brings it down every block.
        let hammer_seconds = 0.002 + 0.004 * (1.0 - hardness);
        let slap_amount = params.at(super::SLAP, 0);
        if slap_amount > 0.0 {
            // A slap: a hard contact with skin noise, no hammer to compensate.
            let exciter = slap(&mut modes, slap_amount);
            // Between the struck tone's level and the slap's, by how much of a slap it is.
            let struck = 1.0 / hammer_response(base * self.bend, hammer_seconds, 0.25);
            let open = (1.0 - slap_amount) * (1.0 - slap_amount);
            self.compensation = SLAP_LEVEL + (struck - SLAP_LEVEL) * open;
            self.bank.strike(&modes, exciter, velocity, 1.0);
        } else {
            self.compensation = 1.0 / hammer_response(base * self.bend, hammer_seconds, 0.25);
            self.bank.strike(&modes, Exciter::Hammer(hammer_seconds), velocity, 0.3 + 0.7 * hardness);
        }
        if self.bending {
            self.bank.retune(self.bend);
        }
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let recorded = self.recorded.render(out);
        self.render_synth(out, params) || recorded
    }
    fn use_samples(&mut self, pack: Option<&'static SamplePack>) {
        self.recorded.set_pack(pack);
    }

    fn steal(&mut self) {
        self.recorded.steal();
        self.bank.steal();
    }

    fn level(&self) -> f32 {
        (self.bank.peak()).max(self.recorded.level())
    }

    fn is_released(&self) -> bool {
        true
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.recorded.reset();
        self.bank.reset();
        self.bending = false;
    }
}
