// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! `gate`: closes below a threshold that the amount moves from −80 to −20 dB, holds
//! 10 ms and releases in 60 ms. (`fx/gate.rs` is the silence detector of the buses.)

use crate::math::{db_to_gain, one_pole_coefficient};

const HOLD_SECONDS: f32 = 0.010;
const ATTACK_SECONDS: f32 = 0.001;
const RELEASE_SECONDS: f32 = 0.060;

#[derive(Clone, Copy)]
pub struct NoiseGate {
    gain: f32,
    hold_left: u32,
    hold_frames: u32,
    attack: f32,
    release: f32,
}

impl NoiseGate {
    pub fn new(sample_rate: f32) -> Self {
        NoiseGate {
            gain: 1.0,
            hold_left: 0,
            hold_frames: (HOLD_SECONDS * sample_rate) as u32,
            attack: one_pole_coefficient(ATTACK_SECONDS, sample_rate),
            release: one_pole_coefficient(RELEASE_SECONDS, sample_rate),
        }
    }

    #[inline]
    pub fn process(&mut self, input: [f32; 2], amount: f32) -> [f32; 2] {
        let threshold = db_to_gain(-80.0 + 60.0 * amount.clamp(0.0, 1.0));
        let level = input[0].abs().max(input[1].abs());
        let open = if level >= threshold {
            self.hold_left = self.hold_frames;
            true
        } else if self.hold_left > 0 {
            self.hold_left -= 1;
            true
        } else {
            false
        };
        let (target, coefficient) = if open {
            (1.0, self.attack)
        } else {
            (0.0, self.release)
        };
        self.gain += coefficient * (target - self.gain);
        [input[0] * self.gain, input[1] * self.gain]
    }

    pub fn reset(&mut self) {
        self.gain = 1.0;
        self.hold_left = 0;
    }
}
