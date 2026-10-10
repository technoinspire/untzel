// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! `eq`: a low shelf at 200 Hz, a peak (Q 0.7) at `eq-mid-freq` and a high shelf at
//! 5 kHz, each −18..18 dB. Biquad coefficients are recomputed once per sub-block, only
//! when a band changed.

use crate::math::db_to_gain;

const LOW_SHELF_HZ: f32 = 200.0;
const HIGH_SHELF_HZ: f32 = 5_000.0;
const PEAK_Q: f32 = 0.7;
const SHELF_SLOPE: f32 = 1.0;

#[derive(Clone, Copy, Default)]
struct Biquad {
    b: [f32; 3],
    a: [f32; 2],
    state: [[f32; 2]; 2],
}

impl Biquad {
    fn identity() -> Self {
        Biquad {
            b: [1.0, 0.0, 0.0],
            a: [0.0, 0.0],
            state: [[0.0; 2]; 2],
        }
    }

    #[inline]
    fn process(&mut self, x: f32, channel: usize) -> f32 {
        // Transposed direct form II.
        let s = &mut self.state[channel];
        let y = self.b[0] * x + s[0];
        s[0] = self.b[1] * x - self.a[0] * y + s[1];
        s[1] = self.b[2] * x - self.a[1] * y;
        y
    }

    fn set(&mut self, b: [f32; 3], a: [f32; 3]) {
        let inverse = 1.0 / a[0];
        self.b = [b[0] * inverse, b[1] * inverse, b[2] * inverse];
        self.a = [a[1] * inverse, a[2] * inverse];
    }

    /// Audio EQ cookbook shelving and peaking filters.
    fn shelf(&mut self, hz: f32, db: f32, high: bool, sample_rate: f32) {
        let a = db_to_gain(db * 0.5);
        let w = core::f32::consts::TAU * hz / sample_rate;
        let (sin, cos) = (w.sin(), w.cos());
        let alpha = sin / 2.0 * ((a + 1.0 / a) * (1.0 / SHELF_SLOPE - 1.0) + 2.0).sqrt();
        let root = 2.0 * a.sqrt() * alpha;
        if high {
            self.set(
                [
                    a * ((a + 1.0) + (a - 1.0) * cos + root),
                    -2.0 * a * ((a - 1.0) + (a + 1.0) * cos),
                    a * ((a + 1.0) + (a - 1.0) * cos - root),
                ],
                [
                    (a + 1.0) - (a - 1.0) * cos + root,
                    2.0 * ((a - 1.0) - (a + 1.0) * cos),
                    (a + 1.0) - (a - 1.0) * cos - root,
                ],
            );
        } else {
            self.set(
                [
                    a * ((a + 1.0) - (a - 1.0) * cos + root),
                    2.0 * a * ((a - 1.0) - (a + 1.0) * cos),
                    a * ((a + 1.0) - (a - 1.0) * cos - root),
                ],
                [
                    (a + 1.0) + (a - 1.0) * cos + root,
                    -2.0 * ((a - 1.0) + (a + 1.0) * cos),
                    (a + 1.0) + (a - 1.0) * cos - root,
                ],
            );
        }
    }

    fn peak(&mut self, hz: f32, db: f32, sample_rate: f32) {
        let a = db_to_gain(db * 0.5);
        let w = core::f32::consts::TAU * hz.min(0.45 * sample_rate) / sample_rate;
        let (sin, cos) = (w.sin(), w.cos());
        let alpha = sin / (2.0 * PEAK_Q);
        self.set(
            [1.0 + alpha * a, -2.0 * cos, 1.0 - alpha * a],
            [1.0 + alpha / a, -2.0 * cos, 1.0 - alpha / a],
        );
    }
}

#[derive(Clone, Copy)]
pub struct Eq {
    bands: [Biquad; 3],
    /// Last (low, mid, mid-freq, high) the coefficients were computed for.
    settings: [f32; 4],
}

impl Default for Eq {
    fn default() -> Self {
        Eq {
            bands: [Biquad::identity(); 3],
            settings: [f32::NAN; 4],
        }
    }
}

impl Eq {
    /// Recomputes the coefficients when a band moved (once per sub-block).
    pub fn prepare(&mut self, low: f32, mid: f32, mid_hz: f32, high: f32, sample_rate: f32) {
        let settings = [low, mid, mid_hz, high];
        if settings == self.settings {
            return;
        }
        self.settings = settings;
        self.bands[0].shelf(LOW_SHELF_HZ, low, false, sample_rate);
        self.bands[1].peak(mid_hz, mid, sample_rate);
        self.bands[2].shelf(
            HIGH_SHELF_HZ.min(0.4 * sample_rate),
            high,
            true,
            sample_rate,
        );
    }

    #[inline]
    pub fn process(&mut self, input: [f32; 2]) -> [f32; 2] {
        let mut out = input;
        for (channel, value) in out.iter_mut().enumerate() {
            for band in &mut self.bands {
                *value = band.process(*value, channel);
            }
        }
        out
    }

    pub fn reset(&mut self) {
        for band in &mut self.bands {
            band.state = [[0.0; 2]; 2];
        }
    }
}
