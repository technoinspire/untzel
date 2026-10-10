// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! `lowpass` and `highpass`: a 12 dB state-variable filter per channel, `q` 0..1.

use crate::math::{Svf, filter_gain};

#[derive(Clone, Copy, Default)]
pub struct StereoSvf {
    channels: [Svf; 2],
}

/// `k` = 1/Q of the SVF for a `q` parameter of 0..1 (0.2 ≈ a gentle 0.6 Q).
#[inline]
pub fn damping(q: f32) -> f32 {
    2.0 - 1.85 * q.clamp(0.0, 1.0)
}

impl StereoSvf {
    #[inline]
    pub fn lowpass(&mut self, input: [f32; 2], cutoff: f32, q: f32, sample_rate: f32) -> [f32; 2] {
        let g = filter_gain(cutoff, sample_rate);
        let k = damping(q);
        [
            self.channels[0].process(input[0], g, k).low,
            self.channels[1].process(input[1], g, k).low,
        ]
    }

    #[inline]
    pub fn highpass(&mut self, input: [f32; 2], cutoff: f32, q: f32, sample_rate: f32) -> [f32; 2] {
        let g = filter_gain(cutoff, sample_rate);
        let k = damping(q);
        [
            self.channels[0].process(input[0], g, k).high,
            self.channels[1].process(input[1], g, k).high,
        ]
    }

    pub fn reset(&mut self) {
        *self = StereoSvf::default();
    }
}
