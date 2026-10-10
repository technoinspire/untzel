// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Tempo-synced delay: three stereo lines, one per division (`1/8`, `3/16`, `1/4`),
//! 2 s each, fixed feedback 0.35 through a gentle low-pass. `set_tempo` moves the read
//! position with a 20 ms linear ramp, so a tempo change glides instead of clicking.

use super::gate::{BusGate, has_signal};
use crate::math::{SILENCE, one_pole_coefficient};
use crate::params::DELAY_DIVISIONS;

/// Divisions of a 4/4 bar, in whole notes.
const DIVISIONS: [f64; DELAY_DIVISIONS] = [1.0 / 8.0, 3.0 / 16.0, 1.0 / 4.0];
const FEEDBACK: f32 = 0.35;
const LINE_SECONDS: f32 = 2.0;
const DAMPING_HZ: f32 = 6_000.0;
pub const DEFAULT_BPM: f64 = 120.0;

struct Line {
    buffers: [Vec<f32>; 2],
    damping: [f32; 2],
    delay: f32,
    delay_target: f32,
    delay_step: f32,
    remaining: u32,
    gate: BusGate,
}

pub struct Delay {
    lines: [Line; DELAY_DIVISIONS],
    write: usize,
    length: usize,
    sample_rate: f32,
    damping_coefficient: f32,
    ramp_frames: u32,
}

impl Delay {
    /// Allocates the six buffers; constructor only.
    pub fn new(sample_rate: f32, ramp_frames: u32) -> Self {
        let length = (LINE_SECONDS * sample_rate) as usize + 2;
        let mut delay = Delay {
            lines: core::array::from_fn(|_| Line {
                buffers: [vec![0.0; length], vec![0.0; length]],
                damping: [0.0; 2],
                delay: 1.0,
                delay_target: 1.0,
                delay_step: 0.0,
                remaining: 0,
                gate: BusGate::new(0),
            }),
            write: 0,
            length,
            sample_rate,
            damping_coefficient: one_pole_coefficient(
                1.0 / (core::f32::consts::TAU * DAMPING_HZ),
                sample_rate,
            ),
            ramp_frames,
        };
        delay.set_tempo(DEFAULT_BPM, 0);
        delay
    }

    /// Duration of each division at `bpm`, reached in `ramp_frames` samples.
    pub fn set_tempo(&mut self, bpm: f64, ramp_frames: u32) {
        if !bpm.is_finite() || bpm <= 0.0 {
            return;
        }
        let max_delay = (self.length - 2) as f32;
        for (line, division) in self.lines.iter_mut().zip(DIVISIONS) {
            let seconds = division * 240.0 / bpm;
            let target = ((seconds * f64::from(self.sample_rate)) as f32).clamp(1.0, max_delay);
            line.delay_target = target;
            if ramp_frames == 0 {
                line.finish_ramp();
            } else {
                line.delay_step = (target - line.delay) / ramp_frames as f32;
                line.remaining = ramp_frames;
            }
            let hold = target.max(line.delay) + 0.1 * self.sample_rate;
            line.gate.set_hold(hold as u32);
        }
    }

    pub fn set_tempo_ramped(&mut self, bpm: f64) {
        self.set_tempo(bpm, self.ramp_frames);
    }

    /// Delay of `division` in samples (current value of the ramp).
    pub fn delay_frames(&self, division: usize) -> f32 {
        self.lines[division].delay
    }

    /// Processes every line for one sub-block: `inputs[d]` is the stereo send into
    /// division `d`; the echoes are added into `out`. Returns the number of open lines.
    pub fn process(
        &mut self,
        inputs: &[[&[f32]; 2]; DELAY_DIVISIONS],
        out: [&mut [f32]; 2],
    ) -> u32 {
        let [out_left, out_right] = out;
        let frames = out_left.len();
        let mut open = 0;
        for (line, input) in self.lines.iter_mut().zip(inputs) {
            let input_has_signal = has_signal(*input);
            if !line.gate.is_open(input_has_signal) {
                line.advance_ramp(frames as u32);
                continue;
            }
            open += 1;
            let peak = line.render(
                self.write,
                self.length,
                self.damping_coefficient,
                *input,
                [&mut *out_left, &mut *out_right],
            );
            line.gate.observe(input_has_signal, peak, frames as u32);
        }
        self.write = (self.write + frames) % self.length;
        open
    }

    /// Delay memory, for the chunked clear after a stop.
    pub fn buffers_mut(&mut self) -> impl Iterator<Item = &mut [f32]> {
        self.lines
            .iter_mut()
            .flat_map(|line| line.buffers.iter_mut().map(Vec::as_mut_slice))
    }

    /// Filters and gates back to rest (the memory is cleared separately, in chunks).
    pub fn reset_state(&mut self) {
        for line in &mut self.lines {
            line.damping = [0.0; 2];
            line.gate.close();
        }
    }
}

impl Line {
    fn advance_ramp(&mut self, frames: u32) {
        if frames >= self.remaining {
            self.finish_ramp();
        } else {
            self.delay += self.delay_step * frames as f32;
            self.remaining -= frames;
        }
    }

    fn finish_ramp(&mut self) {
        self.delay = self.delay_target;
        self.delay_step = 0.0;
        self.remaining = 0;
    }

    /// Returns the output peak.
    fn render(
        &mut self,
        write: usize,
        length: usize,
        damping_coefficient: f32,
        input: [&[f32]; 2],
        out: [&mut [f32]; 2],
    ) -> f32 {
        let [out_left, out_right] = out;
        let mut peak = 0.0_f32;
        for n in 0..out_left.len() {
            if self.remaining > 0 {
                self.advance_ramp(1);
            }
            let position = (write + n) % length;
            // Integer and fractional parts are split before wrapping: wrapping a float
            // position can round up to `length` and index past the buffer.
            let whole = self.delay as usize;
            let fraction = self.delay - whole as f32;
            let newer = (position + length - whole % length) % length;
            let older = if newer == 0 { length - 1 } else { newer - 1 };
            for (channel, out) in [&mut *out_left, &mut *out_right].into_iter().enumerate() {
                let buffer = &mut self.buffers[channel];
                let echo = buffer[newer] + (buffer[older] - buffer[newer]) * fraction;
                let damped = &mut self.damping[channel];
                *damped += damping_coefficient * (echo - *damped);
                buffer[position] = input[channel][n] + FEEDBACK * *damped;
                out[n] += echo;
                peak = peak.max(echo.abs());
            }
        }
        if !peak.is_finite() {
            self.buffers.iter_mut().for_each(|buffer| buffer.fill(0.0));
            self.damping = [0.0; 2];
            return 0.0;
        }
        if peak < SILENCE * 0.01 {
            self.damping = [0.0; 2];
        }
        peak
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn echo_frame(delay: &mut Delay, division: usize) -> usize {
        let silent = [0.0_f32; 128];
        let mut impulse = [0.0_f32; 128];
        impulse[0] = 1.0;
        let mut frame = 0;
        let mut first = true;
        loop {
            let mut inputs: [[&[f32]; 2]; 3] = [[&silent, &silent]; 3];
            if first {
                inputs[division] = [&impulse, &impulse];
                first = false;
            }
            let mut left = [0.0_f32; 128];
            let mut right = [0.0_f32; 128];
            delay.process(&inputs, [&mut left, &mut right]);
            if let Some(n) = left.iter().position(|&x| x > 0.5) {
                return frame + n;
            }
            frame += 128;
            assert!(frame < 200_000, "no echo");
        }
    }

    #[test]
    fn each_division_echoes_at_its_tempo_synced_time() {
        let mut delay = Delay::new(48_000.0, 960);
        delay.set_tempo(120.0, 0);
        assert_eq!(echo_frame(&mut delay, 0), 12_000, "1/8 at 120 bpm = 250 ms");
        let mut delay = Delay::new(48_000.0, 960);
        delay.set_tempo(132.0, 0);
        assert_eq!(echo_frame(&mut delay, 2), 21_818, "1/4 at 132 bpm");
    }

    #[test]
    fn a_tempo_change_ramps_the_read_position() {
        let mut delay = Delay::new(44_100.0, 882);
        delay.set_tempo(120.0, 0);
        let before = delay.delay_frames(1);
        delay.set_tempo_ramped(60.0);
        assert_eq!(delay.delay_frames(1), before, "the ramp has not started");
        let silent = [0.0_f32; 128];
        let inputs: [[&[f32]; 2]; 3] = [[&silent, &silent]; 3];
        for _ in 0..7 {
            let mut left = [0.0_f32; 128];
            let mut right = [0.0_f32; 128];
            delay.process(&inputs, [&mut left, &mut right]);
        }
        assert_eq!(delay.delay_frames(1), before * 2.0);
    }
}
