// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `riser`: band-passed noise and a tone sweeping up while the level grows:
//! the tension before a drop. The sweep runs over the note duration
//! (`x~~~ ~~~~`), or over `length` seconds when it is above 0 (a sweep longer than a
//! bar: `| length 15.5` is 8 bars at 124 BPM; it is tied to the tempo, so a new tempo
//! wants a new length). `color` mixes noise (0) and tone (1).

use crate::engines::limit;
use crate::engines::percussion::{FilteredNoise, NoiseShape, Sweep, exp_sweep, sweep_frames};
use crate::math::{advance_phase, sine};
use crate::voice::{Params, Voice};

const START_HZ: f32 = 200.0;
const LEVEL: f32 = 0.9851;

pub struct RiserVoice {
    sample_rate: f32,
    sweep: Sweep,
    noise: FilteredNoise,
    phase: f32,
    velocity: f32,
    release: f32,
}

impl Voice for RiserVoice {
    fn new(sample_rate: f32) -> Self {
        RiserVoice { sample_rate, sweep: Sweep::default(), noise: FilteredNoise::new(0x7377_6570), phase: 0.0, velocity: 0.0, release: 0.0 }
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
        let end = params.at(super::CUTOFF, 0).max(START_HZ * 1.01);
        let k = 2.0 - 1.8 * params.at(super::RESONANCE, 0);
        let color = params.at(super::COLOR, 0);
        let fade = 1.0 / (0.03 * self.sample_rate);
        for sample in out.iter_mut() {
            let x = self.sweep.tick();
            if self.sweep.is_done() {
                self.release = (self.release - fade).max(0.0);
            }
            let cutoff = exp_sweep(START_HZ, (end / START_HZ).log2(), x);
            let noise = self.noise.next(NoiseShape::Band, cutoff, k, 1.0, self.sample_rate);
            self.phase = advance_phase(self.phase, (exp_sweep(110.0, 3.0, x) / self.sample_rate).min(0.45));
            let tone = sine(self.phase) * 0.5;
            let mixed = noise * (1.0 - color) + tone * color;
            *sample += limit(mixed * (0.15 + 0.85 * x * x) * self.release * self.velocity * LEVEL);
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
