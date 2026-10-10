// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `sweep`: noise through a resonant band-pass (or, with `color` 1, a notch)
//! whose centre moves up, or down with `bend` 1, over the note duration or `length`
//! seconds. `cutoff` is the far end of the sweep.

use crate::engines::limit;
use crate::engines::percussion::{FilteredNoise, NoiseShape, Sweep, exp_sweep, sweep_frames};
use crate::math::{Noise, Svf, filter_gain};
use crate::voice::{Params, Voice};

const LOW_HZ: f32 = 200.0;
const LEVEL: f32 = 0.62;

pub struct SweepVoice {
    sample_rate: f32,
    sweep: Sweep,
    noise: FilteredNoise,
    raw: Noise,
    notch: Svf,
    velocity: f32,
    release: f32,
}

impl Voice for SweepVoice {
    fn new(sample_rate: f32) -> Self {
        SweepVoice {
            sample_rate,
            sweep: Sweep::default(),
            noise: FilteredNoise::new(0x7377_6565),
            raw: Noise::new(0x6e6f_7463),
            notch: Svf::default(),
            velocity: 0.0,
            release: 0.0,
        }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        self.sweep.trigger(sweep_frames(params.at(super::LENGTH, 0), duration_frames, self.sample_rate));
        self.noise.amp.trigger(1.0, 1.0e6, self.sample_rate);
        self.velocity = velocity;
        self.release = 1.0;
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        if self.release <= 0.0 {
            return false;
        }
        let far = params.at(super::CUTOFF, 0).max(LOW_HZ * 1.01);
        let octaves = (far / LOW_HZ).log2();
        let falling = params.at(super::BEND, 0) >= 0.5;
        let notch = params.at(super::COLOR, 0);
        let k = 2.0 - 1.85 * params.at(super::RESONANCE, 0);
        // A narrower band passes less noise but rings louder at its centre: this keeps the
        // resonant sweeps level with the open ones (0.89 is `resonance` 0.6).
        let band_level = (k / 0.89).sqrt();
        let fade = 1.0 / (0.03 * self.sample_rate);
        for sample in out.iter_mut() {
            let x = self.sweep.tick();
            if self.sweep.is_done() {
                self.release = (self.release - fade).max(0.0);
            }
            let position = if falling { 1.0 - x } else { x };
            let centre = exp_sweep(LOW_HZ, octaves, position);
            let band = self.noise.next(NoiseShape::Band, centre, k, 1.0, self.sample_rate);
            let input = self.raw.sample() * 0.5;
            let out_notch = self.notch.process(input, filter_gain(centre, self.sample_rate), k.max(0.3));
            let notched = out_notch.low + out_notch.high;
            let mixed = band * band_level * (1.0 - notch) + notched * notch;
            *sample += limit(mixed * self.release * self.velocity * LEVEL);
        }
        self.release > 0.0
    }

    fn steal(&mut self) {
        self.release = self.release.min(0.06);
    }

    fn level(&self) -> f32 {
        self.release * self.velocity
    }

    fn is_released(&self) -> bool {
        self.sweep.is_done()
    }
}
