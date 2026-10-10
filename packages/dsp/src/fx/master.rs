// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Master chain: a console stage, then a compressor, then a peak limiter with
//! 1 ms lookahead and a −1 dBFS ceiling, then the master gain (20 ms ramp) and the stop
//! fade. The limiter delays the whole mix by `latency_frames()`, equally for every slot.
//!
//! Over 300 lines: with its unit tests; the code alone is under 300.

use crate::math::{DcBlocker, db_to_gain, gain_to_db, one_pole_coefficient, soft_clip};

const COMPRESSOR_THRESHOLD_DB: f32 = -2.0;
const COMPRESSOR_RATIO: f32 = 2.0;
const COMPRESSOR_ATTACK_SECONDS: f32 = 0.005;
const COMPRESSOR_RELEASE_SECONDS: f32 = 0.120;
const LIMITER_CEILING_DB: f32 = -1.0;
/// The console stage: a soft clip around this level with a small bias, as an analog mix
/// bus or tape rounds the peaks and adds a little second and third harmonic. Unity for a
/// quiet signal; it takes about 0.4 dB off a positive −6 dBFS peak and 1.2 dB off a
/// 0 dBFS one, less off the negative half (the bias).
const CONSOLE_HEADROOM: f32 = 1.6;
const CONSOLE_BIAS: f32 = 0.08;
const LIMITER_LOOKAHEAD_SECONDS: f32 = 0.001;
const LIMITER_RELEASE_SECONDS: f32 = 0.080;

struct Compressor {
    envelope_db: f32,
    attack: f32,
    release: f32,
}

impl Compressor {
    fn new(sample_rate: f32) -> Self {
        Compressor {
            envelope_db: 0.0,
            attack: one_pole_coefficient(COMPRESSOR_ATTACK_SECONDS, sample_rate),
            release: one_pole_coefficient(COMPRESSOR_RELEASE_SECONDS, sample_rate),
        }
    }

    /// Gain for a sample whose stereo peak is `level`.
    #[inline]
    fn gain(&mut self, level: f32) -> f32 {
        let over = (gain_to_db(level) - COMPRESSOR_THRESHOLD_DB).max(0.0);
        let reduction = over * (1.0 - 1.0 / COMPRESSOR_RATIO);
        let coefficient = if reduction > self.envelope_db {
            self.attack
        } else {
            self.release
        };
        self.envelope_db += coefficient * (reduction - self.envelope_db);
        if self.envelope_db < 1e-4 {
            return 1.0;
        }
        db_to_gain(-self.envelope_db)
    }
}

struct Limiter {
    delay: [Vec<f32>; 2],
    position: usize,
    ceiling: f32,
    /// Smallest gain needed by any sample still inside the lookahead window.
    held_gain: f32,
    hold_left: usize,
    gain: f32,
    attack: f32,
    release: f32,
}

impl Limiter {
    fn new(sample_rate: f32) -> Self {
        let lookahead = ((LIMITER_LOOKAHEAD_SECONDS * sample_rate).round() as usize).max(1);
        Limiter {
            delay: [vec![0.0; lookahead], vec![0.0; lookahead]],
            position: 0,
            ceiling: db_to_gain(LIMITER_CEILING_DB),
            held_gain: 1.0,
            hold_left: 0,
            gain: 1.0,
            // Reaches 99% of a gain drop within the lookahead.
            attack: 1.0 - (-4.6 / lookahead as f32).exp(),
            release: one_pole_coefficient(LIMITER_RELEASE_SECONDS, sample_rate),
        }
    }

    fn latency(&self) -> usize {
        self.delay[0].len()
    }

    #[inline]
    fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        let level = left.abs().max(right.abs());
        let needed = if level > self.ceiling {
            self.ceiling / level
        } else {
            1.0
        };
        if needed <= self.held_gain {
            self.held_gain = needed;
            self.hold_left = self.latency();
        } else if self.hold_left > 0 {
            self.hold_left -= 1;
        } else {
            self.held_gain = needed;
        }
        let coefficient = if self.held_gain < self.gain {
            self.attack
        } else {
            self.release
        };
        self.gain += coefficient * (self.held_gain - self.gain);
        let delayed_left = core::mem::replace(&mut self.delay[0][self.position], left);
        let delayed_right = core::mem::replace(&mut self.delay[1][self.position], right);
        self.position = (self.position + 1) % self.latency();
        // The smoothed gain may still be short of the target on a steep transient: the
        // final clamp is what makes the ceiling a guarantee.
        (
            (delayed_left * self.gain).clamp(-self.ceiling, self.ceiling),
            (delayed_right * self.gain).clamp(-self.ceiling, self.ceiling),
        )
    }

    fn reset(&mut self) {
        self.delay.iter_mut().for_each(|line| line.fill(0.0));
        self.held_gain = 1.0;
        self.hold_left = 0;
        self.gain = 1.0;
    }
}

/// Linear gain ramp driven per sample.
struct GainRamp {
    value: f32,
    target: f32,
    step: f32,
    remaining: u32,
}

impl GainRamp {
    fn new(value: f32) -> Self {
        GainRamp {
            value,
            target: value,
            step: 0.0,
            remaining: 0,
        }
    }

    fn ramp_to(&mut self, target: f32, frames: u32) {
        self.target = target;
        if frames == 0 {
            self.value = target;
            self.remaining = 0;
        } else {
            self.step = (target - self.value) / frames as f32;
            self.remaining = frames;
        }
    }

    #[inline]
    fn advance(&mut self) -> f32 {
        if self.remaining > 0 {
            self.remaining -= 1;
            self.value = if self.remaining == 0 {
                self.target
            } else {
                self.value + self.step
            };
        }
        self.value
    }
}

/// The console stage of one sample (the bias's offset is taken back out).
#[inline]
fn console(x: f32) -> f32 {
    let bias = CONSOLE_BIAS / CONSOLE_HEADROOM;
    CONSOLE_HEADROOM * (soft_clip(x / CONSOLE_HEADROOM + bias) - soft_clip(bias))
}

pub struct Master {
    /// One-pole DC blockers at 5 Hz on left and right, before the dynamics.
    blockers: [DcBlocker; 2],
    pole: f32,
    compressor: Compressor,
    limiter: Limiter,
    gain: GainRamp,
    ramp_frames: u32,
}

/// Fade applied by `untzel_stop`: 1 until `at`, then linear to 0 in `frames`.
#[derive(Clone, Copy)]
pub struct StopFade {
    pub at: f64,
    pub frames: u32,
}

impl StopFade {
    #[inline]
    pub fn gain(self, frame: f64) -> f32 {
        let elapsed = frame - self.at;
        if elapsed <= 0.0 {
            1.0
        } else {
            (1.0 - elapsed / f64::from(self.frames)).max(0.0) as f32
        }
    }

    pub fn end(self) -> f64 {
        self.at + f64::from(self.frames)
    }
}

impl Master {
    pub fn new(sample_rate: f32, ramp_frames: u32) -> Self {
        Master {
            blockers: [DcBlocker::default(); 2],
            pole: DcBlocker::coefficient(sample_rate),
            compressor: Compressor::new(sample_rate),
            limiter: Limiter::new(sample_rate),
            gain: GainRamp::new(1.0),
            ramp_frames,
        }
    }

    pub fn set_gain(&mut self, value: f32) {
        if value.is_finite() {
            self.gain.ramp_to(value.clamp(0.0, 1.0), self.ramp_frames);
        }
    }

    pub fn latency_frames(&self) -> usize {
        self.limiter.latency()
    }

    /// Processes the mix of one sub-block in place; `frame` is the first sample's frame.
    pub fn process(&mut self, mix: [&mut [f32]; 2], frame: f64, fade: Option<StopFade>) {
        let [left, right] = mix;
        for sample in left.iter_mut().chain(right.iter_mut()) {
            *sample = console(*sample);
        }
        self.blockers[0].process(left, self.pole);
        self.blockers[1].process(right, self.pole);
        for n in 0..left.len() {
            let (l, r) = sanitize(left[n], right[n]);
            let compression = self.compressor.gain(l.abs().max(r.abs()));
            let (l, r) = self.limiter.process(l * compression, r * compression);
            let fade = fade.map_or(1.0, |fade| fade.gain(frame + n as f64));
            let gain = self.gain.advance() * fade;
            left[n] = l * gain;
            right[n] = r * gain;
        }
    }

    pub fn reset(&mut self) {
        self.compressor.envelope_db = 0.0;
        self.limiter.reset();
        self.blockers = [DcBlocker::default(); 2];
    }
}

#[inline]
fn sanitize(left: f32, right: f32) -> (f32, f32) {
    if left.is_finite() && right.is_finite() {
        (left, right)
    } else {
        (0.0, 0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_limiter_never_passes_the_ceiling() {
        let mut master = Master::new(48_000.0, 960);
        let mut left = [0.0_f32; 128];
        let mut right = [0.0_f32; 128];
        let mut peak = 0.0_f32;
        for block in 0..200 {
            for n in 0..128 {
                let t = (block * 128 + n) as f32;
                left[n] = 40.0 * (t * 0.05).sin();
                right[n] = if n == 64 { 1e6 } else { -left[n] };
            }
            master.process([&mut left, &mut right], 0.0, None);
            peak = left.iter().chain(&right).fold(peak, |p, x| p.max(x.abs()));
        }
        assert!(peak <= db_to_gain(-1.0) + 1e-6, "{peak}");
    }

    #[test]
    fn quiet_material_passes_untouched_after_the_lookahead() {
        let mut master = Master::new(48_000.0, 960);
        let mut left = [0.0_f32; 128];
        left[0] = 0.1;
        let mut right = [0.0_f32; 128];
        master.process([&mut left, &mut right], 0.0, None);
        let latency = master.latency_frames();
        assert_eq!(latency, 48);
        // The console stage leaves a quiet sample within 0.1 dB.
        assert!((left[latency] - 0.1).abs() < 0.001, "{}", left[latency]);
        assert!(left[..latency].iter().all(|&x| x == 0.0));
    }

    #[test]
    fn the_console_is_unity_when_quiet_and_rounds_loud_peaks() {
        assert!((console(0.01) - 0.01).abs() < 1e-4);
        assert!((console(-0.01) + 0.01).abs() < 1e-4);
        let peak = console(0.5);
        assert!(peak < 0.5 && peak > 0.47, "{peak}");
        assert!(console(4.0) < 1.6 && console(-4.0) > -1.7);
    }

    #[test]
    fn the_stop_fade_is_linear_to_zero() {
        let fade = StopFade {
            at: 100.0,
            frames: 10,
        };
        assert_eq!(fade.gain(100.0), 1.0);
        assert_eq!(fade.gain(105.0), 0.5);
        assert_eq!(fade.gain(110.0), 0.0);
        assert_eq!(fade.end(), 110.0);
    }
}
