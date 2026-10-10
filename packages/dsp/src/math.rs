// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Small numeric helpers shared by voices and effects. Everything here is allocation
//! free and cheap enough to run per sample.
//!
//! Over 300 lines: with its unit tests; the code alone is under 300.

use core::f32::consts::PI;

/// −90 dBFS: below this a slot or bus counts as silent.
pub const SILENCE: f32 = 3.162_277_7e-5;

/// Linear gain of a level in dB.
#[inline]
pub fn db_to_gain(db: f32) -> f32 {
    (db * (core::f32::consts::LN_10 / 20.0)).exp()
}

/// Level in dB of a linear gain (floored at −200 dB).
#[inline]
pub fn gain_to_db(gain: f32) -> f32 {
    20.0 * gain.max(1e-10).log10()
}

/// Per-sample multiplier that falls by 60 dB in `seconds`.
#[inline]
pub fn decay_coefficient(seconds: f32, sample_rate: f32) -> f32 {
    let frames = (seconds * sample_rate).max(1.0);
    (-6.907_755_4 / frames).exp()
}

/// Per-sample coefficient of a one-pole smoother with time constant `seconds`.
#[inline]
pub fn one_pole_coefficient(seconds: f32, sample_rate: f32) -> f32 {
    let frames = (seconds * sample_rate).max(1.0);
    1.0 - (-1.0 / frames).exp()
}

/// Rational approximation of tanh, exact at 0 and saturating at ±1 from |x| = 3.
#[inline]
pub fn soft_clip(x: f32) -> f32 {
    let x = x.clamp(-3.0, 3.0);
    let x2 = x * x;
    x * (27.0 + x2) / (27.0 + 9.0 * x2)
}

/// Antiderivative of `soft_clip` (continuous past the clamp at ±3, where the clipper is ±1).
#[inline]
pub fn soft_clip_integral(x: f32) -> f32 {
    let inner = |u: f32| u * u / 18.0 + (4.0 / 3.0) * (9.0 * u * u + 27.0).ln();
    if x.abs() <= 3.0 {
        inner(x)
    } else {
        inner(3.0) + (x.abs() - 3.0)
    }
}

/// First-order antiderivative anti-aliasing (Parker, Zavalishin, Le Bihan, DAFx 2016) of
/// `soft_clip`: the mean of the clipper between the previous and this input, so the
/// harmonics a hard drive makes fold back far less (half a sample of delay).
#[derive(Clone, Copy, Default)]
pub struct AdaaClip {
    previous: f32,
    previous_integral: f32,
}

impl AdaaClip {
    #[inline]
    pub fn process(&mut self, x: f32) -> f32 {
        let integral = soft_clip_integral(x);
        let delta = x - self.previous;
        let y = if delta.abs() > 1.0e-4 {
            (integral - self.previous_integral) / delta
        } else {
            soft_clip(0.5 * (x + self.previous))
        };
        self.previous = x;
        self.previous_integral = integral;
        y
    }
}

/// Saturation by `drive` (0..1): linear at 0, then a crossfade into a soft clipper
/// driven up to `1 + depth`, normalised so that a full-scale input keeps its peak.
#[inline]
pub fn saturate(x: f32, drive: f32, depth: f32) -> f32 {
    let k = 1.0 + drive * depth;
    let clipped = soft_clip(x * k) / soft_clip(k);
    x + drive * (clipped - x)
}

/// `sin(2π phase)` for `phase` in `[0, 1)`: a refined parabola, error under 0.1%
/// (harmonics below −60 dB), much cheaper than `f32::sin` per sample.
#[inline]
pub fn sine(phase: f32) -> f32 {
    let x = phase - 0.5;
    let y = 8.0 * x - 16.0 * x * x.abs();
    -(0.225 * (y * y.abs() - y) + y)
}

/// Moves an oscillator phase in `[0, 1)` by `increment` (< 1).
#[inline]
pub fn advance_phase(phase: f32, increment: f32) -> f32 {
    let next = phase + increment;
    if next >= 1.0 { next - 1.0 } else { next }
}

/// Band-limited step correction of a sawtooth (polyBLEP), `dt` = frequency / rate.
#[inline]
pub fn poly_blep(phase: f32, dt: f32) -> f32 {
    if phase < dt {
        let x = phase / dt;
        x + x - x * x - 1.0
    } else if phase > 1.0 - dt {
        let x = (phase - 1.0) / dt;
        x * x + x + x + 1.0
    } else {
        0.0
    }
}

/// Midi note to Hz (`a4` = 69 = 440 Hz).
#[inline]
pub fn midi_to_hz(note: f32) -> f32 {
    440.0 * ((note - 69.0) * (core::f32::consts::LN_2 / 12.0)).exp()
}

/// Prewarped integrator gain of a TPT filter, `tan(π fc / sr)`, by a [3/2] Padé
/// approximant. `fc` is clamped to `[10 Hz, 0.45 sr]`, where the error stays under 3%.
#[inline]
pub fn filter_gain(cutoff: f32, sample_rate: f32) -> f32 {
    let x = PI * cutoff.clamp(10.0, 0.45 * sample_rate) / sample_rate;
    let x2 = x * x;
    x * (15.0 - x2) / (15.0 - 6.0 * x2)
}

/// Two-pole state-variable filter (topology-preserving transform). Stable for any
/// positive gain, so the cutoff can move every sample.
#[derive(Clone, Copy, Default)]
pub struct Svf {
    ic1: f32,
    ic2: f32,
}

/// Low-pass, band-pass and high-pass outputs of one `Svf` step.
pub struct SvfOutput {
    pub low: f32,
    pub band: f32,
    pub high: f32,
}

impl Svf {
    /// `g` from `filter_gain`, `k` = 1/Q.
    #[inline]
    pub fn process(&mut self, input: f32, g: f32, k: f32) -> SvfOutput {
        let a1 = 1.0 / (1.0 + g * (g + k));
        let a2 = g * a1;
        let a3 = g * a2;
        let v3 = input - self.ic2;
        let v1 = a1 * self.ic1 + a2 * v3;
        let v2 = self.ic2 + a2 * self.ic1 + a3 * v3;
        self.ic1 = 2.0 * v1 - self.ic1;
        self.ic2 = 2.0 * v2 - self.ic2;
        SvfOutput {
            low: v2,
            band: v1,
            high: input - k * v1 - v2,
        }
    }

    /// `process` with the band integrator soft-clipped around `headroom`, as
    /// the integrators of an analog state-variable filter saturate: a loud or resonant
    /// voice rounds off and thickens instead of ringing clean. Below about a third of
    /// `headroom` it is `process`.
    #[inline]
    pub fn process_saturated(&mut self, input: f32, g: f32, k: f32, headroom: f32) -> SvfOutput {
        let output = self.process(input, g, k);
        self.ic1 = headroom * soft_clip(self.ic1 / headroom);
        output
    }
}

/// xorshift32 white noise in `[-1, 1)`. Deterministic for a given seed.
#[derive(Clone, Copy)]
pub struct Noise {
    state: u32,
}

impl Noise {
    pub const fn new(seed: u32) -> Self {
        Noise {
            state: if seed == 0 { 0x9e37_79b9 } else { seed },
        }
    }

    /// Folds `value` into the state (a murmur3 finaliser), so two generators that start
    /// from one seed part ways as soon as they see different values. Never leaves zero.
    pub fn mix(&mut self, value: u32) {
        let mut h = self.state ^ value.wrapping_mul(0x9e37_79b9);
        h ^= h >> 16;
        h = h.wrapping_mul(0x85eb_ca6b);
        h ^= h >> 13;
        h = h.wrapping_mul(0xc2b2_ae35);
        h ^= h >> 16;
        self.state = if h == 0 { 0x9e37_79b9 } else { h };
    }

    #[inline]
    pub fn sample(&mut self) -> f32 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.state = x;
        (x >> 8) as f32 * (2.0 / 16_777_216.0) - 1.0
    }
}

/// Below this a one-pole DC blocker attenuates: far under
/// the lowest note an instrument plays (E1, 41 Hz), so it only takes the offset away.
pub const DC_BLOCK_HZ: f32 = 5.0;
/// The blocker's tail is cut here, so silence never decays into denormals.
const DENORMAL_FLOOR: f32 = 1.0e-20;
/// A blocker tail under this (−80 dBFS) is dropped once its input is silent.
const SILENT_TAIL: f32 = 1.0e-4;

/// One-pole DC blocker, `y[n] = x[n] − x[n−1] + R·y[n−1]`: a pulse with an offset, a
/// sum of asymmetric waves or a saturated voice leaves no DC to eat the limiter's headroom
/// and no step under 20 Hz at the start and end of a note.
#[derive(Clone, Copy, Default)]
pub struct DcBlocker {
    input: f32,
    output: f32,
}

impl DcBlocker {
    /// The pole `R` for `sample_rate`.
    pub fn coefficient(sample_rate: f32) -> f32 {
        (-core::f32::consts::TAU * DC_BLOCK_HZ / sample_rate).exp()
    }

    /// Filters `buffer` in place with the pole `r`.
    #[inline]
    pub fn process(&mut self, buffer: &mut [f32], r: f32) {
        // A silent block after a quiet tail ends the tail: the step is below −80 dBFS and
        // a silenced slot (`audible 0`) or a stopped mix stays exactly zero (tests/audible.rs).
        if self.output.abs() < SILENT_TAIL && buffer.iter().all(|&x| x == 0.0) {
            *self = DcBlocker::default();
            return;
        }
        for sample in buffer {
            let x = *sample;
            self.output = x - self.input + r * self.output;
            if self.output.abs() < DENORMAL_FLOOR {
                self.output = 0.0;
            }
            self.input = x;
            *sample = self.output;
        }
    }

    /// Forgets the history (stop, NaN recovery).
    pub fn reset(&mut self) {
        *self = DcBlocker::default();
    }
}

/// Peak of the absolute value of a buffer.
#[inline]
pub fn peak(buffer: &[f32]) -> f32 {
    buffer
        .iter()
        .fold(0.0_f32, |max, sample| max.max(sample.abs()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn soft_clip_is_bounded_and_odd() {
        for i in -100..=100 {
            let x = i as f32 * 0.1;
            assert!(soft_clip(x).abs() <= 1.0);
            assert_eq!(soft_clip(-x), -soft_clip(x));
        }
    }

    #[test]
    fn sine_matches_the_library_sine() {
        for i in 0..1000 {
            let phase = i as f32 / 1000.0;
            let exact = (2.0 * PI * phase).sin();
            assert!((sine(phase) - exact).abs() < 1.2e-3, "{phase}");
        }
    }

    #[test]
    fn filter_gain_tracks_tan_below_the_clamp() {
        for cutoff in [40.0, 600.0, 3000.0, 8000.0, 19_000.0] {
            let exact = (PI * cutoff / 44_100.0).tan();
            let approx = filter_gain(cutoff, 44_100.0);
            assert!((approx - exact).abs() / exact < 0.03, "{cutoff}");
        }
    }

    #[test]
    fn noise_stays_in_range() {
        let mut noise = Noise::new(1);
        for _ in 0..100_000 {
            let value = noise.sample();
            assert!((-1.0..1.0).contains(&value));
        }
    }

    #[test]
    fn decay_reaches_minus_60_db() {
        let coefficient = decay_coefficient(0.5, 48_000.0);
        let level = coefficient.powi(24_000);
        assert!((gain_to_db(level) + 60.0).abs() < 0.1);
    }
}
