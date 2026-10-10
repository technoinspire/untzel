// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Percussion blocks: a tone with a pitch envelope, filtered noise, hand-clap bursts,
//! a metallic cluster of six inharmonic pulses, and a sweep that runs over the note
//! duration or a fixed length (risers, downlifters, filter sweeps). Instruments combine
//! them in their `voice.rs`.

use crate::engines::env::Decay;
use crate::engines::fast_exp2;
use crate::math::{Noise, Svf, advance_phase, filter_gain, poly_blep, sine};

/// A sine whose pitch falls from `start_hz` to `end_hz` with `bend_seconds`.
#[derive(Clone, Copy)]
pub struct Tone {
    phase: f32,
    hz: f32,
    end_hz: f32,
    bend: f32,
    pub amp: Decay,
}

impl Tone {
    pub fn new() -> Self {
        Tone {
            phase: 0.0,
            hz: 100.0,
            end_hz: 100.0,
            bend: 0.0,
            amp: Decay::default(),
        }
    }

    pub fn trigger(
        &mut self,
        start_hz: f32,
        end_hz: f32,
        bend_seconds: f32,
        level: f32,
        decay: f32,
        sample_rate: f32,
    ) {
        self.hz = start_hz;
        self.end_hz = end_hz;
        self.bend = (-1.0 / (bend_seconds.max(0.0005) * sample_rate)).exp();
        self.phase = 0.0;
        self.amp.trigger(level, decay, sample_rate);
    }

    /// Moves the resting pitch (legato), keeping the phase.
    pub fn glide_to(&mut self, end_hz: f32) {
        self.end_hz = end_hz;
    }

    #[inline]
    pub fn next(&mut self, sample_rate: f32) -> f32 {
        self.hz = self.end_hz + (self.hz - self.end_hz) * self.bend;
        self.phase = advance_phase(self.phase, (self.hz / sample_rate).min(0.45));
        sine(self.phase) * self.amp.tick()
    }

    pub fn reset(&mut self) {
        *self = Tone::new();
    }
}

impl Default for Tone {
    fn default() -> Self {
        Tone::new()
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum NoiseShape {
    Low,
    Band,
    High,
}

/// White noise through a state-variable filter.
#[derive(Clone, Copy)]
pub struct FilteredNoise {
    noise: Noise,
    filter: Svf,
    /// One-pole state for a pinker colour.
    pink: f32,
    pub amp: Decay,
}

impl FilteredNoise {
    pub fn new(seed: u32) -> Self {
        FilteredNoise {
            noise: Noise::new(seed),
            filter: Svf::default(),
            pink: 0.0,
            amp: Decay::default(),
        }
    }

    /// `color` 0 pink-ish .. 1 white, `k` = 1/Q.
    #[inline]
    pub fn next(
        &mut self,
        shape: NoiseShape,
        cutoff: f32,
        k: f32,
        color: f32,
        sample_rate: f32,
    ) -> f32 {
        let white = self.noise.sample();
        self.pink += 0.08 * (white - self.pink);
        let source = self.pink * 3.0 * (1.0 - color) + white * color;
        let output = self
            .filter
            .process(source, filter_gain(cutoff, sample_rate), k);
        let value = match shape {
            NoiseShape::Low => output.low,
            NoiseShape::Band => output.band,
            NoiseShape::High => output.high,
        };
        value * self.amp.tick()
    }

    pub fn reset(&mut self) {
        self.filter = Svf::default();
        self.pink = 0.0;
        self.amp.reset();
    }
}

/// Hand-clap envelope: `count` short bursts `spacing` seconds apart, then a tail.
#[derive(Clone, Copy, Default)]
pub struct Bursts {
    frame: u32,
    spacing: u32,
    count: u32,
    burst: Decay,
    pub tail: Decay,
    burst_seconds: f32,
    tail_seconds: f32,
    sample_rate: f32,
    level: f32,
}

impl Bursts {
    pub fn trigger(
        &mut self,
        count: u32,
        spacing: f32,
        tail_seconds: f32,
        level: f32,
        sample_rate: f32,
    ) {
        self.frame = 0;
        self.count = count.max(1);
        self.spacing = ((spacing * sample_rate) as u32).max(1);
        self.burst_seconds = (spacing * 0.9).max(0.002);
        self.tail_seconds = tail_seconds;
        self.sample_rate = sample_rate;
        self.level = level;
        self.burst.trigger(level, self.burst_seconds, sample_rate);
        self.tail.trigger(0.0, tail_seconds, sample_rate);
    }

    #[inline]
    pub fn tick(&mut self) -> f32 {
        let index = self.frame / self.spacing;
        if self.frame.is_multiple_of(self.spacing) && index > 0 {
            if index < self.count {
                self.burst
                    .trigger(self.level, self.burst_seconds, self.sample_rate);
            } else if index == self.count {
                self.tail
                    .trigger(self.level * 0.8, self.tail_seconds, self.sample_rate);
            }
        }
        self.frame = self.frame.saturating_add(1);
        self.burst.tick() + self.tail.tick()
    }

    pub fn set_tail(&mut self, seconds: f32) {
        self.tail_seconds = seconds;
        self.tail.set_time(seconds, self.sample_rate.max(1.0));
    }

    pub fn level(&self) -> f32 {
        self.burst.level() + self.tail.level()
    }

    pub fn is_done(&self) -> bool {
        self.frame / self.spacing.max(1) > self.count && self.tail.level() < 1e-5
    }

    pub fn reset(&mut self) {
        self.burst.reset();
        self.tail.reset();
        self.frame = u32::MAX / 2;
    }
}

/// Six inharmonic pulse oscillators summed: the raw metal of cymbals, rides and bells.
/// The ratios are irrational-looking multiples chosen for Untzel.
#[derive(Clone, Copy, Default)]
pub struct Metal {
    phases: [f32; 6],
}

const METAL_RATIOS: [f32; 6] = [1.0, 1.342, 1.783, 2.118, 2.571, 3.137];

impl Metal {
    #[inline]
    pub fn next(&mut self, base_hz: f32, sample_rate: f32) -> f32 {
        let mut sum = 0.0;
        for (phase, ratio) in self.phases.iter_mut().zip(METAL_RATIOS) {
            let dt = (base_hz * ratio / sample_rate).min(0.45);
            *phase = advance_phase(*phase, dt);
            let shifted = if *phase >= 0.5 {
                *phase - 0.5
            } else {
                *phase + 0.5
            };
            let square = (2.0 * *phase - 1.0 - poly_blep(*phase, dt))
                - (2.0 * shifted - 1.0 - poly_blep(shifted, dt));
            sum += square;
        }
        sum / 6.0
    }

    pub fn reset(&mut self) {
        self.phases = [0.0; 6];
    }
}

/// Progress 0..1 over a length in frames (the note duration or a fixed time).
#[derive(Clone, Copy, Default)]
pub struct Sweep {
    frame: u32,
    length: u32,
}

impl Sweep {
    pub fn trigger(&mut self, length_frames: u32) {
        self.frame = 0;
        self.length = length_frames.max(1);
    }

    /// Current progress, advancing one frame.
    #[inline]
    pub fn tick(&mut self) -> f32 {
        let x = (self.frame as f32 / self.length as f32).min(1.0);
        self.frame = self.frame.saturating_add(1);
        x
    }

    pub fn is_done(&self) -> bool {
        self.frame >= self.length
    }

    pub fn reset(&mut self) {
        self.frame = 0;
        self.length = 0;
    }
}

/// Exponential sweep from `from` across `octaves` (negative falls) at progress `x`.
#[inline]
pub fn exp_sweep(from: f32, octaves: f32, x: f32) -> f32 {
    from * fast_exp2(x * octaves)
}

/// Length of a sweep: `length` seconds when above 0, otherwise the note duration.
pub fn sweep_frames(length_seconds: f32, duration_frames: u32, sample_rate: f32) -> u32 {
    if length_seconds > 0.0 {
        (length_seconds * sample_rate) as u32
    } else {
        duration_frames
    }
}
