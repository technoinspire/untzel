// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! `crush`: fewer bits (16 down to 4) and a lower sample rate (hold 1 to 16 samples),
//! mixed in as the amount rises.

#[derive(Clone, Copy, Default)]
pub struct Crush {
    held: [f32; 2],
    counter: u32,
}

impl Crush {
    #[inline]
    pub fn process(&mut self, input: [f32; 2], amount: f32) -> [f32; 2] {
        let amount = amount.clamp(0.0, 1.0);
        let bits = 16.0 - 12.0 * amount;
        let levels = (bits - 1.0).exp2();
        let hold = 1 + (15.0 * amount) as u32;
        if self.counter == 0 {
            for (held, x) in self.held.iter_mut().zip(input) {
                *held = (x * levels).round() / levels;
            }
        }
        self.counter = (self.counter + 1) % hold.max(1);
        let mix = (4.0 * amount).min(1.0);
        [
            input[0] + mix * (self.held[0] - input[0]),
            input[1] + mix * (self.held[1] - input[1]),
        ]
    }

    pub fn reset(&mut self) {
        *self = Crush::default();
    }
}
