// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `rim`: four short modes of a struck rim with a noise click. `tune` moves
//! the modes over two octaves, `decay` is their ring.

use crate::engines::modal::{Exciter, ModalBank, Mode};
use crate::voice::{Params, Voice};

const RATIOS: [f32; 4] = [1.0, 2.31, 3.72, 5.13];
const GAINS: [f32; 4] = [1.0, 0.6, 0.35, 0.2];
const LEVEL: f32 = 0.1923;

pub struct RimVoice {
    bank: ModalBank<4>,
    velocity: f32,
}

impl Voice for RimVoice {
    fn new(sample_rate: f32) -> Self {
        RimVoice { bank: ModalBank::new(sample_rate, 0x7269_6d00), velocity: 0.0 }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, _duration_frames: u32, params: &Params) {
        let base = 420.0 * (2.0_f32).powf(2.0 * params.at(super::TUNE, 0));
        let decay = params.at(super::DECAY, 0);
        let mut modes = [Mode::default(); 4];
        for (k, mode) in modes.iter_mut().enumerate() {
            *mode = Mode { hz: base * RATIOS[k], gain: GAINS[k], decay: decay / (1.0 + 0.6 * k as f32) };
        }
        self.bank.strike(&modes, Exciter::Noise(0.0015), velocity, 1.0);
        self.velocity = velocity;
    }

    fn render(&mut self, out: &mut [f32], _params: &Params) -> bool {
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
    }
}
