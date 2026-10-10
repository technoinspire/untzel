// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Band-limited oscillators of the virtual analog engine: polyBLEP saw and pulse (a
//! cubic B-spline step residual), triangle and sine, with an optional hard-sync reset.

use crate::math::{advance_phase, poly_blep, sine};

/// Oscillator shape; the order is the manifest order of the `wave` choice.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Wave {
    Saw,
    Square,
    Triangle,
    Sine,
}

impl Wave {
    /// The `wave` choice index (`saw`, `square`, `triangle`, `sine`).
    pub fn from_index(index: usize) -> Wave {
        match index {
            1 => Wave::Square,
            2 => Wave::Triangle,
            3 => Wave::Sine,
            _ => Wave::Saw,
        }
    }
}

/// Integral of the cubic B-spline from −2 to `t` (−2 ≤ t ≤ 0).
#[inline]
fn bspline_step(t: f32) -> f32 {
    if t <= -1.0 {
        let u = t + 2.0;
        u * u * u * u / 24.0
    } else {
        let t2 = t * t;
        0.5 + (4.0 * t - 2.0 * t2 * t - 0.75 * t2 * t2) / 6.0
    }
}

/// Band-limited step residual of a phase wrap, over two samples on each side (a cubic
/// B-spline kernel). Returns `r` such that a falling step of 2 becomes
/// `naive - 2 r`. Above a quarter of the sample rate it falls back to the two-point
/// polyBLEP, whose regions cannot overlap.
#[inline]
fn blep4(phase: f32, dt: f32) -> f32 {
    if dt >= 0.25 {
        return 0.5 * poly_blep(phase, dt);
    }
    if phase < 2.0 * dt {
        -bspline_step(-phase / dt)
    } else if phase > 1.0 - 2.0 * dt {
        bspline_step((phase - 1.0) / dt)
    } else {
        0.0
    }
}

#[inline]
fn saw(phase: f32, dt: f32) -> f32 {
    2.0 * phase - 1.0 - 2.0 * blep4(phase, dt)
}

#[inline]
fn shape(phase: f32, dt: f32, wave: Wave, width: f32) -> f32 {
    match wave {
        Wave::Saw => saw(phase, dt),
        Wave::Square => {
            // Pulse = difference of two band-limited saws, `width` apart.
            let width = width.clamp(0.05, 0.95);
            let shifted = {
                let p = phase + 1.0 - width;
                if p >= 1.0 { p - 1.0 } else { p }
            };
            saw(phase, dt) - saw(shifted, dt) + (1.0 - 2.0 * width)
        }
        Wave::Triangle => 1.0 - 4.0 * (phase - 0.5).abs(),
        Wave::Sine => sine(phase),
    }
}

#[derive(Clone, Copy, Default)]
pub struct Oscillator {
    pub phase: f32,
    /// A synced slave plays one sample late: the sample it holds, and the step correction
    /// the reset adds to it (polyBLEP over the two samples around the reset).
    held: f32,
    pending: f32,
}

impl Oscillator {
    #[inline]
    pub fn next(&mut self, increment: f32, wave: Wave, width: f32) -> f32 {
        let dt = increment.min(0.45);
        self.phase = advance_phase(self.phase, dt);
        shape(self.phase, dt, wave, width)
    }

    /// Like `next`, and also whether the phase wrapped (the sync source of a slave).
    #[inline]
    pub fn next_wrapping(&mut self, increment: f32, wave: Wave, width: f32) -> (f32, bool) {
        let before = self.phase;
        let value = self.next(increment, wave, width);
        (value, self.phase < before)
    }

    /// A hard-synced slave: restarts its cycle when the master wrapped, keeping the
    /// fraction of a sample the master is past its wrap. Its wave is read with the
    /// fundamental in the phase of a saw's, so crossfading the two never cancels it.
    #[inline]
    pub fn next_synced(
        &mut self,
        increment: f32,
        wave: Wave,
        width: f32,
        master: Option<f32>,
    ) -> f32 {
        let dt = increment.min(0.45);
        let continuing = advance_phase(self.phase, dt);
        self.phase = match master {
            Some(fraction) => (fraction * dt).min(0.999),
            None => continuing,
        };
        let value = shape(Self::aligned(self.phase, wave), dt, wave, width);
        // The reset is a step of `value − continued` `fraction` samples before this one:
        // half of its residual lands on the held sample, the rest on this one.
        let mut out = self.held + self.pending;
        self.pending = 0.0;
        if let Some(fraction) = master {
            let step = value - shape(Self::aligned(continuing, wave), dt, wave, width);
            let d = fraction.clamp(0.0, 1.0);
            out += step * 0.5 * d * d;
            self.pending = -step * 0.5 * (1.0 - d) * (1.0 - d);
        }
        self.held = value;
        out
    }

    /// The wave read with its fundamental in the phase of a saw's (a sine is half a cycle
    /// off, a triangle a quarter), so crossfading the two never cancels it.
    #[inline]
    fn aligned(phase: f32, wave: Wave) -> f32 {
        match wave {
            Wave::Sine => advance_phase(phase, 0.5),
            Wave::Triangle => advance_phase(phase, 0.75),
            Wave::Saw | Wave::Square => phase,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_wrap_is_reported_once_per_cycle() {
        let mut oscillator = Oscillator::default();
        let wraps = (0..4_800)
            .filter(|_| oscillator.next_wrapping(0.01, Wave::Saw, 0.5).1)
            .count();
        assert!((47..=48).contains(&wraps), "{wraps}");
    }

    #[test]
    fn a_synced_slave_restarts_with_its_master() {
        let mut master = Oscillator::default();
        let mut slave = Oscillator::default();
        for _ in 0..1_000 {
            let (_, wrapped) = master.next_wrapping(0.01, Wave::Saw, 0.5);
            let reset = wrapped.then_some(master.phase / 0.01);
            slave.next_synced(0.027, Wave::Saw, 0.5, reset);
            if wrapped {
                assert!(slave.phase < 0.03, "{}", slave.phase);
            }
        }
    }
}
