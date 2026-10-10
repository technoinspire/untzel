// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `snare`: two tuned body tones with a short pitch drop plus high-passed
//! noise (the wires). `snap` balances wires against body, `tune` moves the body,
//! `decay` sets the wires' length.

use crate::engines::limit;
use crate::engines::percussion::{FilteredNoise, NoiseShape, Tone};
use crate::voice::{Params, Voice};

const LEVEL: f32 = 0.3977;

pub struct SnareVoice {
    sample_rate: f32,
    body: Tone,
    overtone: Tone,
    wires: FilteredNoise,
    velocity: f32,
}

impl Voice for SnareVoice {
    fn new(sample_rate: f32) -> Self {
        SnareVoice {
            sample_rate,
            body: Tone::new(),
            overtone: Tone::new(),
            wires: FilteredNoise::new(0x736e_6172),
            velocity: 0.0,
        }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, _duration_frames: u32, params: &Params) {
        let hz = 140.0 * (1.0 + 1.4 * params.at(super::TUNE, 0));
        let snap = params.at(super::SNAP, 0);
        let decay = params.at(super::DECAY, 0);
        let body = 1.0 - 0.8 * snap;
        self.body.trigger(hz * 1.6, hz, 0.012, body, 0.08 + 0.25 * decay, self.sample_rate);
        self.overtone.trigger(hz * 2.6, hz * 1.62, 0.01, body * 0.5, 0.05 + 0.1 * decay, self.sample_rate);
        self.wires.amp.trigger(0.3 + 0.7 * snap, decay, self.sample_rate);
        self.velocity = velocity;
    }

    fn render(&mut self, out: &mut [f32], _params: &Params) -> bool {
        for sample in out.iter_mut() {
            let tone = self.body.next(self.sample_rate) + self.overtone.next(self.sample_rate);
            let wires = self.wires.next(NoiseShape::High, 1_800.0, 1.2, 1.0, self.sample_rate);
            *sample += limit((tone + wires) * self.velocity * LEVEL);
        }
        self.level() > 1e-5
    }

    fn steal(&mut self) {
        self.body.amp.set_time(0.002, self.sample_rate);
        self.overtone.amp.set_time(0.002, self.sample_rate);
        self.wires.amp.set_time(0.002, self.sample_rate);
    }

    fn level(&self) -> f32 {
        (self.body.amp.level() + self.wires.amp.level()) * self.velocity
    }

    fn is_released(&self) -> bool {
        true
    }
}
