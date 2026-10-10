// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `noise`: white to pink noise through a resonant low-pass, held for the
//! note's duration (`x~~~`) with a soft attack and release: wind, air and textures.

use crate::engines::env::{Adsr, AdsrTimes};
use crate::engines::limit;
use crate::engines::percussion::{FilteredNoise, NoiseShape};
use crate::voice::{Params, Voice};

const LEVEL: f32 = 0.6;
const TIMES: AdsrTimes = AdsrTimes { attack: 0.005, decay: 1.0, sustain: 1.0, release: 0.08 };

pub struct NoiseVoice {
    sample_rate: f32,
    noise: FilteredNoise,
    amp: Adsr,
}

impl Voice for NoiseVoice {
    fn new(sample_rate: f32) -> Self {
        NoiseVoice { sample_rate, noise: FilteredNoise::new(0x6e6f_6973), amp: Adsr::new(sample_rate) }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, duration_frames: u32, _params: &Params) {
        self.amp.trigger(velocity, duration_frames, TIMES);
        self.noise.amp.trigger(1.0, 1.0e6, self.sample_rate);
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        if !self.amp.is_active() {
            return false;
        }
        let k = 2.0 - 1.85 * params.at(super::RESONANCE, 0);
        let color = params.at(super::COLOR, 0);
        for (n, sample) in out.iter_mut().enumerate() {
            let cutoff = params.at(super::CUTOFF, n);
            let x = self.noise.next(NoiseShape::Low, cutoff, k, color, self.sample_rate);
            *sample += limit(x * self.amp.tick() * LEVEL);
        }
        self.amp.is_active()
    }

    fn steal(&mut self) {
        self.amp.steal();
    }

    fn level(&self) -> f32 {
        self.amp.level()
    }

    fn is_released(&self) -> bool {
        self.amp.is_released()
    }
}
