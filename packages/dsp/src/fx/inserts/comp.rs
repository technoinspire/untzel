// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! `comp`: one amount moves the threshold from 0 to −30 dB and the ratio from 1 to 8,
//! with a 5 ms attack, an 80 ms release, a stereo-linked peak detector and automatic
//! make-up gain.

use crate::math::{db_to_gain, gain_to_db, one_pole_coefficient};

const ATTACK_SECONDS: f32 = 0.005;
const RELEASE_SECONDS: f32 = 0.080;

#[derive(Clone, Copy)]
pub struct Compressor {
    envelope: f32,
    attack: f32,
    release: f32,
}

impl Compressor {
    pub fn new(sample_rate: f32) -> Self {
        Compressor {
            envelope: 0.0,
            attack: one_pole_coefficient(ATTACK_SECONDS, sample_rate),
            release: one_pole_coefficient(RELEASE_SECONDS, sample_rate),
        }
    }

    #[inline]
    pub fn process(&mut self, input: [f32; 2], amount: f32) -> [f32; 2] {
        let amount = amount.clamp(0.0, 1.0);
        let level = input[0].abs().max(input[1].abs());
        let coefficient = if level > self.envelope {
            self.attack
        } else {
            self.release
        };
        self.envelope += coefficient * (level - self.envelope);
        let threshold = -30.0 * amount;
        let ratio = 1.0 + 7.0 * amount;
        let over = gain_to_db(self.envelope) - threshold;
        let reduction = if over > 0.0 {
            over * (1.0 - 1.0 / ratio)
        } else {
            0.0
        };
        let makeup = -threshold * (1.0 - 1.0 / ratio) * 0.5;
        let gain = db_to_gain(makeup - reduction);
        [input[0] * gain, input[1] * gain]
    }

    pub fn reset(&mut self) {
        self.envelope = 0.0;
    }
}
