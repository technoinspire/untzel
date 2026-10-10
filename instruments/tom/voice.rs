// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `tom`: eight membrane modes with a pitch drop. `tune` sets the drum size,
//! `bend` the drop, `hardness` the stick.

use crate::engines::modal::{Exciter, ModalBank, Mode, hammer_response};
use crate::engines::skin::Skin;
use crate::voice::{Params, Voice};

const RATIOS: [f32; 8] = [1.0, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501];
const GAINS: [f32; 8] = [1.0, 0.5, 0.35, 0.25, 0.18, 0.12, 0.08, 0.05];
/// Lowest fundamental (tune 0) and the octaves `tune` spans.
const LOW_HZ: f32 = 70.0;
const TUNE_OCTAVES: f32 = 2.2;
/// The stick contact: centre, length and level at full hardness.
const SKIN_HZ: f32 = 2_800.0;
const SKIN_SECONDS: f32 = 0.04;
const SKIN_LEVEL: f32 = 0.4;
const LEVEL: f32 = 0.6956;

pub struct TomVoice {
    sample_rate: f32,
    bank: ModalBank<8>,
    /// Pitch ratio above the resting pitch, falling to 1 (the bend).
    bend: f32,
    bend_coefficient: f32,
    bending: bool,
    /// 1 ÷ the hammer response at the struck fundamental (every sound of the drum
    /// peaks alike, whatever the stick and the size).
    compensation: f32,
    skin: Skin,
}

impl Voice for TomVoice {
    fn new(sample_rate: f32) -> Self {
        TomVoice { sample_rate, bank: ModalBank::new(sample_rate, 0x746f_6d00), bend: 1.0, bend_coefficient: 1.0, bending: false, compensation: 1.0, skin: Skin::new(0x746f_6d01) }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, _duration_frames: u32, params: &Params) {
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
        let exciter = Exciter::Hammer(hammer_seconds);
        self.compensation = 1.0 / hammer_response(base * self.bend, hammer_seconds, 0.25);
        self.bank.strike(&modes, exciter, velocity, 0.3 + 0.7 * hardness);
        if self.bending {
            self.bank.retune(self.bend);
        }
        let contact = SKIN_LEVEL * velocity * (0.35 + 0.65 * hardness);
        self.skin.strike(contact, SKIN_HZ, SKIN_SECONDS, self.sample_rate);
    }

    fn render(&mut self, out: &mut [f32], _params: &Params) -> bool {
        if self.bending {
            self.bend = 1.0 + (self.bend - 1.0) * self.bend_coefficient.powi(out.len() as i32);
            self.bank.retune(self.bend);
            self.bending = self.bend > 1.001;
        }
        let ringing = self.bank.render(out, LEVEL * self.compensation);
        self.skin.render(out) || ringing
    }

    fn steal(&mut self) {
        self.bank.steal();
    }

    fn level(&self) -> f32 {
        self.bank.peak()
    }

    fn is_released(&self) -> bool {
        true
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.bank.reset();
        self.skin.reset();
        self.bending = false;
    }
}
