// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! 24 dB ladder low-pass of the virtual analog engine. Each of the four stages
//! soft-clips its input, after Huovilainen's non-linear model of the
//! transistor ladder (DAFx 2004): the filter colours and compresses a loud or resonant
//! signal the way the analog one does, and stays linear for a quiet one.

use crate::math::soft_clip;

/// Level around which each stage starts to saturate.
const STAGE_HEADROOM: f32 = 2.0;

/// 24 dB ladder low-pass, topology-preserving, solved for the linear feedback loop with
/// a soft clipper on the loop input. Stable for any cutoff moving every sample.
#[derive(Clone, Copy, Default)]
pub struct Ladder {
    s: [f32; 4],
}

impl Ladder {
    /// `g` from `filter_gain`, `resonance` 0..1 (self-oscillation near 1).
    #[inline]
    pub fn process(&mut self, input: f32, g: f32, resonance: f32) -> f32 {
        let k = 3.9 * resonance.clamp(0.0, 1.0);
        let big_g = g / (1.0 + g);
        let b = 1.0 / (1.0 + g);
        let g2 = big_g * big_g;
        let g4 = g2 * g2;
        let sigma = big_g * big_g * big_g * b * self.s[0]
            + g2 * b * self.s[1]
            + big_g * b * self.s[2]
            + b * self.s[3];
        // Loss of bass with resonance is compensated by driving the input harder.
        let compensated = input * (1.0 + 0.5 * k);
        let y4 = (g4 * compensated + sigma) / (1.0 + k * g4);
        let mut x = soft_clip(compensated - k * y4);
        for state in &mut self.s {
            let v = (STAGE_HEADROOM * soft_clip(x / STAGE_HEADROOM) - *state) * big_g;
            let y = v + *state;
            *state = y + v;
            x = y;
        }
        x
    }

    pub fn reset(&mut self) {
        self.s = [0.0; 4];
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::{Noise, filter_gain};

    #[test]
    fn the_ladder_stays_finite_with_full_resonance_and_moving_cutoff() {
        let mut ladder = Ladder::default();
        let mut noise = Noise::new(3);
        for n in 0..96_000 {
            let cutoff = 10.0 + (n % 4_800) as f32 * 4.5;
            let y = ladder.process(noise.sample() * 4.0, filter_gain(cutoff, 48_000.0), 1.0);
            assert!(y.is_finite() && y.abs() < 10.0);
        }
    }
}
