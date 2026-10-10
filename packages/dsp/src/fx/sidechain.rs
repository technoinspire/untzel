// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Envelope of the summed `kick` slots (attack 1 ms, release 120 ms). Each slot
//! multiplies its signal by `1 − duck × envelope`.

use crate::math::one_pole_coefficient;

pub struct Sidechain {
    envelope: f32,
    attack: f32,
    release: f32,
}

impl Sidechain {
    pub fn new(sample_rate: f32) -> Self {
        Sidechain {
            envelope: 0.0,
            attack: one_pole_coefficient(0.001, sample_rate),
            release: one_pole_coefficient(0.120, sample_rate),
        }
    }

    /// Turns the summed kick signal in `buffer` into the envelope, in place, in `0..1`.
    pub fn follow(&mut self, buffer: &mut [f32]) {
        for sample in buffer {
            let level = sample.abs();
            let coefficient = if level > self.envelope {
                self.attack
            } else {
                self.release
            };
            self.envelope += coefficient * (level - self.envelope);
            if !self.envelope.is_finite() {
                self.envelope = 0.0;
            }
            *sample = self.envelope.min(1.0);
        }
    }

    pub fn reset(&mut self) {
        self.envelope = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rises_fast_and_falls_slowly() {
        let mut sidechain = Sidechain::new(48_000.0);
        let mut hit = [1.0_f32; 480];
        sidechain.follow(&mut hit);
        assert!(hit[479] > 0.99, "10 ms after a full-scale hit");
        let mut tail = [0.0_f32; 4800];
        sidechain.follow(&mut tail);
        assert!(
            tail[4799] > 0.3 && tail[4799] < 0.5,
            "100 ms into the release"
        );
    }
}
