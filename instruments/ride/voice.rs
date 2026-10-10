// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `ride`: a metal cluster with a bell ping and a little noise wash. `color` moves the band-pass, `size` widens it and lowers
//! the metal, `decay` is the ring.

use crate::engines::env::Decay;
use crate::engines::limit;
use crate::engines::percussion::{FilteredNoise, Metal, NoiseShape};
use crate::math::{Svf, filter_gain};
use crate::voice::{Params, Voice};

const BASE_HZ: f32 = 560.0;
const LEVEL: f32 = 1.006;
const NOISE: f32 = 0.25;

pub struct RideVoice {
    sample_rate: f32,
    metal: Metal,
    noise: FilteredNoise,
    band: Svf,
    high: Svf,
    amp: Decay,
    velocity: f32,
}

impl Voice for RideVoice {
    fn new(sample_rate: f32) -> Self {
        RideVoice {
            sample_rate,
            metal: Metal::default(),
            noise: FilteredNoise::new(0x6379_6d62),
            band: Svf::default(),
            high: Svf::default(),
            amp: Decay::default(),
            velocity: 0.0,
        }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, _duration_frames: u32, params: &Params) {
        let decay = params.at(super::DECAY, 0);
        self.amp.trigger(1.0, decay, self.sample_rate);
        self.noise.amp.trigger(NOISE, decay * 0.35, self.sample_rate);
        self.velocity = velocity;
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let color = params.at(super::COLOR, 0);
        let size = params.at(super::SIZE, 0);
        let base = BASE_HZ * (1.2 - 0.5 * size);
        let band_g = filter_gain(4_000.0 + 6_000.0 * color, self.sample_rate);
        let band_k = 0.6 + 1.2 * size;
        let high_g = filter_gain(5_000.0, self.sample_rate);
        for sample in out.iter_mut() {
            let metal = self.metal.next(base, self.sample_rate);
            let noise = self.noise.next(NoiseShape::High, 7_000.0, 1.0, 1.0, self.sample_rate);
            let banded = self.band.process(metal, band_g, band_k).band;
            let bright = self.high.process(banded + noise, high_g, 1.0).high;
            *sample += limit(bright * self.amp.tick() * self.velocity * LEVEL);
        }
        self.amp.level() > 1e-5
    }

    fn steal(&mut self) {
        self.amp.set_time(0.002, self.sample_rate);
        self.noise.amp.set_time(0.002, self.sample_rate);
    }

    fn level(&self) -> f32 {
        self.amp.level() * self.velocity
    }

    fn is_released(&self) -> bool {
        true
    }
}
