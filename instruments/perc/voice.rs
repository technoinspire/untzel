// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `perc`: eight modes of a free bar, from wooden block to metal ping; `bend`
//! drops the pitch after the hit (a water drop).

use crate::engines::modal::{Exciter, ModalBank, Mode};
use crate::voice::{Params, Voice};

const RATIOS: [f32; 8] = [1.0, 2.756, 5.404, 8.933, 13.34, 1.5, 3.9, 6.8];
const GAINS: [f32; 8] = [1.0, 0.55, 0.3, 0.18, 0.1, 0.25, 0.12, 0.08];
/// Lowest fundamental (tune 0) and the octaves `tune` spans.
const LOW_HZ: f32 = 260.0;
const TUNE_OCTAVES: f32 = 2.5;
const LEVEL: f32 = 4.251;

pub struct PercVoice {
    sample_rate: f32,
    bank: ModalBank<8>,
    /// Pitch ratio above the resting pitch, falling to 1 (the bend).
    bend: f32,
    bend_coefficient: f32,
    bending: bool,
}

impl Voice for PercVoice {
    fn new(sample_rate: f32) -> Self {
        PercVoice { sample_rate, bank: ModalBank::new(sample_rate, 0x7065_7263), bend: 1.0, bend_coefficient: 1.0, bending: false }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, _duration_frames: u32, params: &Params) {
        let base = LOW_HZ * (TUNE_OCTAVES * params.at(super::TUNE, 0)).exp2();
        let decay = params.at(super::DECAY, 0);
        let hardness = 0.6_f32;
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
        let exciter = Exciter::Hammer(0.002 + 0.004 * (1.0 - hardness));
        self.bank.strike(&modes, exciter, velocity, 0.3 + 0.7 * hardness);
        if self.bending {
            self.bank.retune(self.bend);
        }
    }

    fn render(&mut self, out: &mut [f32], _params: &Params) -> bool {
        if self.bending {
            self.bend = 1.0 + (self.bend - 1.0) * self.bend_coefficient.powi(out.len() as i32);
            self.bank.retune(self.bend);
            self.bending = self.bend > 1.001;
        }
        self.bank.render(out, LEVEL)
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
        self.bending = false;
    }
}
