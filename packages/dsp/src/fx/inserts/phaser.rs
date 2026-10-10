// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! `phaser`: four first-order all-pass stages per channel swept between 200 Hz and
//! 2 kHz by a slow LFO, with feedback 0.5, mixed with the dry signal.

use crate::engines::fast_exp2;
use crate::math::{advance_phase, sine};

const STAGES: usize = 4;
const FEEDBACK: f32 = 0.5;
const LOW_HZ: f32 = 200.0;
const OCTAVES: f32 = 3.32;

#[derive(Clone, Copy, Default)]
pub struct Phaser {
    states: [[f32; STAGES]; 2],
    feedback: [f32; 2],
    phase: f32,
}

impl Phaser {
    #[inline]
    pub fn process(
        &mut self,
        input: [f32; 2],
        amount: f32,
        rate_hz: f32,
        sample_rate: f32,
    ) -> [f32; 2] {
        self.phase = advance_phase(self.phase, (rate_hz / sample_rate).min(0.45));
        let mut out = [0.0; 2];
        for channel in 0..2 {
            let lfo = if channel == 0 {
                sine(self.phase)
            } else {
                sine((self.phase + 0.25) % 1.0)
            };
            let hz = LOW_HZ * fast_exp2(OCTAVES * 0.5 * (1.0 + lfo));
            let t = (core::f32::consts::PI * hz / sample_rate).min(1.4);
            // First-order all-pass coefficient (tan approximated, t is small).
            let tan = t * (1.0 + t * t / 3.0);
            let a = (1.0 - tan) / (1.0 + tan);
            let mut x = input[channel] + FEEDBACK * self.feedback[channel];
            for state in &mut self.states[channel] {
                let y = -a * x + *state;
                *state = x + a * y;
                x = y;
            }
            self.feedback[channel] = x.clamp(-4.0, 4.0);
            let mix = 0.5 * amount.clamp(0.0, 1.0);
            out[channel] = input[channel] * (1.0 - mix) + x * mix;
        }
        out
    }

    pub fn reset(&mut self) {
        *self = Phaser::default();
    }
}
