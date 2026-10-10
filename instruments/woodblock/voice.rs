// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
//! Voice of `woodblock`: the modes of a hollow wooden bar: a short, bright knock; `tune` sets the
//! size of the block and `hardness` the stick.
//! Recorded (VCSL CC0): `hardness` crossfades a mezzo-piano stroke into a fortissimo one; `tune` moves the pitch.
use crate::engines::modal::{Exciter, ModalBank, Mode, hammer_response};
use crate::engines::sampler::{Hit, RecordedHit, SamplePack};
use crate::voice::{Params, Voice};

const RATIOS: [f32; 8] = [1.0, 2.71, 5.18, 8.4, 1.5, 3.6, 6.2, 11.0];
const GAINS: [f32; 8] = [1.0, 0.5, 0.25, 0.1, 0.2, 0.12, 0.08, 0.04];
/// Lowest fundamental (tune 0) and the octaves `tune` spans.
const LOW_HZ: f32 = 500.0;
const TUNE_OCTAVES: f32 = 1.5;
const LEVEL: f32 = 0.5;

/// The recording's level, fitted on pnpm sim --levels against the synthesis.
const RECORDED_LEVEL: f32 = 1.06;
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;
pub struct WoodblockVoice {
    /// The recorded hit, when `source` is `samples` and the pack is there.
    recorded: RecordedHit,
    sample_rate: f32,
    bank: ModalBank<8>,
    /// Pitch ratio above the resting pitch, falling to 1 (the bend).
    bend: f32,
    bend_coefficient: f32,
    bending: bool,
    /// 1 ÷ the hammer response at the struck fundamental (every sound of the drum
    /// peaks alike, whatever the hand).
    compensation: f32,
}

impl WoodblockVoice {
    fn render_synth(&mut self, out: &mut [f32], _params: &Params) -> bool {
        if self.bending {
            self.bend = 1.0 + (self.bend - 1.0) * self.bend_coefficient.powi(out.len() as i32);
            self.bank.retune(self.bend);
            self.bending = self.bend > 1.001;
        }
        self.bank.render(out, LEVEL * self.compensation)
    }
}
impl Voice for WoodblockVoice {
    fn new(sample_rate: f32) -> Self {
        WoodblockVoice { recorded: RecordedHit::new(sample_rate, RECORDED_LEVEL), sample_rate, bank: ModalBank::new(sample_rate, 0x776f_6f64), bend: 1.0, bend_coefficient: 1.0, bending: false, compensation: 1.0 }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        let hit = Hit { position: params.at(super::HARDNESS, 0), note: 72.0 + 12.0 * (params.at(super::TUNE, 0) - 0.5), velocity, decay: params.at(super::DECAY, 0), brightness: 0.5 };
        if self.recorded.trigger(params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES, hit, duration_frames) {
            self.bank.steal();
            return;
        }
        let base = LOW_HZ * (TUNE_OCTAVES * params.at(super::TUNE, 0)).exp2();
        let decay = params.at(super::DECAY, 0);
        let hardness = params.at(super::HARDNESS, 0);
        let mut modes = [Mode::default(); 8];
        for (k, mode) in modes.iter_mut().enumerate() {
            let gain = GAINS[k] * if k == 0 { 1.0 } else { 0.3 + 1.0 * hardness };
            *mode = Mode { hz: base * RATIOS[k], gain, decay: decay / (1.0 + 1.2 * k as f32) };
        }
        let bend = 0.0_f32;
        self.bend = 1.0 + bend;
        self.bend_coefficient = (-1.0 / ((0.02 + 0.25 * decay) * self.sample_rate)).exp();
        self.bending = bend > 0.0;
        let hammer_seconds = 0.0006 + 0.002 * (1.0 - hardness);
        self.compensation = 1.0 / hammer_response(base * self.bend, hammer_seconds, 0.25);
        self.bank.strike(&modes, Exciter::Hammer(hammer_seconds), velocity, 0.3 + 0.7 * hardness);
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
