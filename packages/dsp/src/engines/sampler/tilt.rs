// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Brightness of the sampler: a one-pole split at TILT_HZ that keeps the lows as they
//! are and scales the highs, so `brightness` 0.5 leaves the recording untouched.

/// Corner of the brightness tilt: above it `brightness` 0..1 scales the highs by 0..2
/// (0.5 leaves the recording as it is).
const TILT_HZ: f32 = 1_200.0;

#[derive(Clone, Copy, Debug)]
pub struct BrightnessTilt {
    coefficient: f32,
    /// The low band of the left and right channels.
    low: [f32; 2],
}

impl BrightnessTilt {
    pub fn new(sample_rate: f32) -> Self {
        BrightnessTilt {
            coefficient: 1.0 - (-core::f32::consts::TAU * TILT_HZ / sample_rate).exp(),
            low: [0.0; 2],
        }
    }

    /// The highs of `l` and `r` times `highs` (2 × `brightness`), the lows as they are.
    pub fn apply(&mut self, l: f32, r: f32, highs: f32) -> [f32; 2] {
        let mut out = [l, r];
        for (x, low) in out.iter_mut().zip(self.low.iter_mut()) {
            *low += self.coefficient * (*x - *low);
            *x = *low + highs * (*x - *low);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unit_highs_leave_the_signal_as_it_is() {
        let mut tilt = BrightnessTilt::new(48_000.0);
        for n in 0..64 {
            let x = if n % 2 == 0 { 0.5 } else { -0.25 };
            let [l, r] = tilt.apply(x, -x, 1.0);
            assert!((l - x).abs() < 1e-6 && (r + x).abs() < 1e-6);
        }
    }

    #[test]
    fn zero_highs_keep_only_the_lows() {
        let mut tilt = BrightnessTilt::new(48_000.0);
        let peak = (0..256)
            .map(|n| tilt.apply(if n % 2 == 0 { 1.0 } else { -1.0 }, 0.0, 0.0)[0].abs())
            .skip(128)
            .fold(0.0_f32, f32::max);
        assert!(peak < 0.1, "Nyquist tone through the lows only: {peak}");
    }
}
