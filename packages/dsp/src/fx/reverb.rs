// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Shared reverb: seven buses, each an 8-line feedback delay network with a Hadamard
//! mix, its own line lengths (the size), decay time and damping (the colour): `small`,
//! `wide` and `sea`, and the rooms: `room` (a small wooden room, dark and
//! short), `plate` (dense, bright, medium), `hall` (large and open) and `dub` (very long
//! and dark, the dub chamber).
//!
//! The send is high-passed at INPUT_HP_HZ (the tail no longer piles up 40–250 Hz under
//! kick and bass) and spread by four all-pass diffusers per channel before it enters the
//! network, with alternating signs across the lines: echoes thicken at once instead of
//! ringing as a comb (the metallic peaks of the short rooms; toy-sound report 4d).
//!
//! Over 300 lines: with its unit tests; the code alone is under 300.

use super::gate::{BusGate, has_signal};
use crate::math::one_pole_coefficient;
use crate::params::REVERB_SPACES;

const LINES: usize = 8;
/// Gain of the summed line outputs, so a bus returns roughly its input level.
const OUTPUT_GAIN: f32 = 0.35;
/// Scale of the 8×8 Hadamard matrix (1/√8): the mix is energy preserving.
const HADAMARD_SCALE: f32 = 0.353_553_38;
/// High-pass of the send, Hz.
const INPUT_HP_HZ: f32 = 180.0;
/// All-pass diffusers of the input, ms per channel (mutually prime-ish, Dattorro-like).
const DIFFUSER_MS: [[f32; 4]; 2] = [[4.77, 3.59, 12.73, 9.31], [5.13, 3.91, 11.87, 8.69]];
const DIFFUSION: f32 = 0.62;
/// Sign of the input on each line: decorrelates the lines from the first sample.
const INJECT_SIGNS: [f32; LINES] = [1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0];

/// Schroeder all-pass of one diffuser.
struct AllPass {
    buffer: Vec<f32>,
    position: usize,
}

impl AllPass {
    fn new(length: usize) -> Self {
        AllPass {
            buffer: vec![0.0; length.max(1)],
            position: 0,
        }
    }

    #[inline]
    fn process(&mut self, x: f32) -> f32 {
        let delayed = self.buffer[self.position];
        let w = x + DIFFUSION * delayed;
        self.buffer[self.position] = w;
        self.position = if self.position + 1 == self.buffer.len() {
            0
        } else {
            self.position + 1
        };
        delayed - DIFFUSION * w
    }
}

struct Space {
    lengths_ms: [f32; LINES],
    decay_seconds: f32,
    damping_hz: f32,
}

const SPACES: [Space; REVERB_SPACES] = [
    Space {
        lengths_ms: [11.3, 13.7, 16.1, 18.9, 21.2, 23.9, 26.5, 29.1],
        decay_seconds: 0.7,
        damping_hz: 7_000.0,
    },
    Space {
        lengths_ms: [29.7, 33.1, 37.9, 41.3, 45.7, 49.9, 53.3, 58.1],
        decay_seconds: 2.4,
        damping_hz: 5_000.0,
    },
    Space {
        lengths_ms: [47.1, 53.9, 61.3, 67.7, 73.1, 79.9, 86.3, 93.7],
        decay_seconds: 6.0,
        damping_hz: 2_500.0,
    },
    // room
    Space {
        lengths_ms: [5.3, 6.7, 7.9, 9.1, 10.3, 11.9, 13.1, 14.7],
        decay_seconds: 0.45,
        damping_hz: 3_500.0,
    },
    // plate
    Space {
        lengths_ms: [7.1, 8.3, 9.7, 11.3, 12.7, 14.1, 15.7, 17.3],
        decay_seconds: 1.8,
        damping_hz: 11_000.0,
    },
    // hall
    Space {
        lengths_ms: [61.7, 69.1, 77.3, 83.9, 91.1, 97.3, 105.7, 113.9],
        decay_seconds: 3.6,
        damping_hz: 6_000.0,
    },
    // dub
    Space {
        lengths_ms: [83.3, 97.1, 109.9, 121.3, 133.7, 145.1, 157.9, 169.3],
        decay_seconds: 9.0,
        damping_hz: 1_500.0,
    },
];

struct Network {
    lines: [Vec<f32>; LINES],
    positions: [usize; LINES],
    feedback: [f32; LINES],
    damping: [f32; LINES],
    damping_coefficient: f32,
    gate: BusGate,
    diffusers: [[AllPass; 4]; 2],
    /// One-pole high-pass state of the send, per channel: (previous input, previous output).
    high_pass: [(f32, f32); 2],
    high_pass_coefficient: f32,
}

pub struct Reverb {
    networks: [Network; REVERB_SPACES],
}

impl Reverb {
    /// Allocates every line; constructor only.
    pub fn new(sample_rate: f32) -> Self {
        Reverb {
            networks: core::array::from_fn(|bus| Network::new(&SPACES[bus], sample_rate)),
        }
    }

    /// Processes the three buses for one sub-block: `inputs[b]` is the stereo send into
    /// space `b`; the reverb is added into `out`. Returns the number of open buses.
    pub fn process(&mut self, inputs: &[[&[f32]; 2]; REVERB_SPACES], out: [&mut [f32]; 2]) -> u32 {
        let [out_left, out_right] = out;
        let frames = out_left.len() as u32;
        let mut open = 0;
        for (network, input) in self.networks.iter_mut().zip(inputs) {
            let input_has_signal = has_signal(*input);
            if !network.gate.is_open(input_has_signal) {
                continue;
            }
            open += 1;
            let peak = network.render(*input, [&mut *out_left, &mut *out_right]);
            network.gate.observe(input_has_signal, peak, frames);
        }
        open
    }

    pub fn buffers_mut(&mut self) -> impl Iterator<Item = &mut [f32]> {
        self.networks.iter_mut().flat_map(|network| {
            let Network {
                lines, diffusers, ..
            } = network;
            lines.iter_mut().map(Vec::as_mut_slice).chain(
                diffusers
                    .iter_mut()
                    .flatten()
                    .map(|d| d.buffer.as_mut_slice()),
            )
        })
    }

    pub fn reset_state(&mut self) {
        for network in &mut self.networks {
            network.damping = [0.0; LINES];
            network.high_pass = [(0.0, 0.0); 2];
            network.gate.close();
        }
    }
}

impl Network {
    fn new(space: &Space, sample_rate: f32) -> Self {
        let lengths: [usize; LINES] =
            core::array::from_fn(|i| ((space.lengths_ms[i] * 0.001 * sample_rate) as usize).max(1));
        let longest = lengths.iter().copied().max().unwrap_or(1);
        Network {
            lines: core::array::from_fn(|i| vec![0.0; lengths[i]]),
            positions: [0; LINES],
            // −60 dB after `decay_seconds`: g = 10^(−3 · length / (T60 · sr)).
            feedback: core::array::from_fn(|i| {
                10_f32.powf(-3.0 * lengths[i] as f32 / (space.decay_seconds * sample_rate))
            }),
            damping: [0.0; LINES],
            damping_coefficient: one_pole_coefficient(
                1.0 / (core::f32::consts::TAU * space.damping_hz),
                sample_rate,
            ),
            gate: BusGate::new((longest as f32 + 0.1 * sample_rate) as u32),
            diffusers: core::array::from_fn(|c| {
                core::array::from_fn(|k| {
                    AllPass::new((DIFFUSER_MS[c][k] * 0.001 * sample_rate) as usize)
                })
            }),
            high_pass: [(0.0, 0.0); 2],
            high_pass_coefficient: (-core::f32::consts::TAU * INPUT_HP_HZ / sample_rate).exp(),
        }
    }

    /// Returns the output peak.
    fn render(&mut self, input: [&[f32]; 2], out: [&mut [f32]; 2]) -> f32 {
        let [out_left, out_right] = out;
        let mut peak = 0.0_f32;
        for n in 0..out_left.len() {
            let mut sent = [0.0_f32; 2];
            for (c, value) in sent.iter_mut().enumerate() {
                let x = input[c][n];
                let (previous_in, previous_out) = self.high_pass[c];
                let high = self.high_pass_coefficient * (previous_out + x - previous_in);
                self.high_pass[c] = (x, high);
                *value = self.diffusers[c]
                    .iter_mut()
                    .fold(high, |signal, diffuser| diffuser.process(signal));
            }
            let mut taps = [0.0_f32; LINES];
            for (i, tap) in taps.iter_mut().enumerate() {
                let read = self.lines[i][self.positions[i]];
                self.damping[i] += self.damping_coefficient * (read - self.damping[i]);
                *tap = self.damping[i];
            }
            let left = taps[0] + taps[2] + taps[4] + taps[6];
            let right = taps[1] + taps[3] + taps[5] + taps[7];
            hadamard(&mut taps);
            for (i, tap) in taps.iter().enumerate() {
                let injected = INJECT_SIGNS[i] * if i < LINES / 2 { sent[0] } else { sent[1] };
                let line = &mut self.lines[i];
                line[self.positions[i]] = injected + tap * HADAMARD_SCALE * self.feedback[i];
                self.positions[i] = if self.positions[i] + 1 == line.len() {
                    0
                } else {
                    self.positions[i] + 1
                };
            }
            out_left[n] += left * OUTPUT_GAIN;
            out_right[n] += right * OUTPUT_GAIN;
            peak = peak.max(left.abs()).max(right.abs());
        }
        if !peak.is_finite() {
            self.lines.iter_mut().for_each(|line| line.fill(0.0));
            self.diffusers
                .iter_mut()
                .flatten()
                .for_each(|d| d.buffer.fill(0.0));
            self.damping = [0.0; LINES];
            self.high_pass = [(0.0, 0.0); 2];
            return 0.0;
        }
        peak * OUTPUT_GAIN
    }
}

/// In-place unnormalised fast Walsh–Hadamard transform of 8 values.
#[inline]
fn hadamard(values: &mut [f32; LINES]) {
    let mut width = 1;
    while width < LINES {
        for start in (0..LINES).step_by(width * 2) {
            for i in start..start + width {
                let (a, b) = (values[i], values[i + width]);
                values[i] = a + b;
                values[i + width] = a - b;
            }
        }
        width *= 2;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tail_energy(bus: usize, seconds: f32) -> f32 {
        let sample_rate = 48_000.0;
        let mut reverb = Reverb::new(sample_rate);
        let silent = [0.0_f32; 128];
        let mut impulse = [0.0_f32; 128];
        impulse[0] = 1.0;
        let blocks = (seconds * sample_rate / 128.0) as usize;
        let mut energy = 0.0;
        for block in 0..blocks {
            let mut inputs: [[&[f32]; 2]; REVERB_SPACES] = [[&silent, &silent]; REVERB_SPACES];
            if block == 0 {
                inputs[bus] = [&impulse, &impulse];
            }
            let mut left = [0.0_f32; 128];
            let mut right = [0.0_f32; 128];
            reverb.process(&inputs, [&mut left, &mut right]);
            if block + 40 > blocks {
                energy += left.iter().chain(&right).map(|x| x * x).sum::<f32>();
            }
        }
        energy
    }

    #[test]
    fn larger_spaces_ring_longer() {
        let small = tail_energy(0, 1.0);
        let wide = tail_energy(1, 1.0);
        let sea = tail_energy(2, 1.0);
        assert!(small < wide && wide < sea, "{small} {wide} {sea}");
    }
    #[test]
    fn the_rooms_ring_in_their_order_room_plate_hall_dub() {
        let tails = [3, 4, 5, 6].map(|bus| tail_energy(bus, 1.5));
        assert!(tails.windows(2).all(|pair| pair[0] < pair[1]), "{tails:?}");
    }

    #[test]
    fn hadamard_is_orthogonal_up_to_scale() {
        let mut values = [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
        hadamard(&mut values);
        hadamard(&mut values);
        assert_eq!(values[0], 8.0);
        assert!(values[1..].iter().all(|&v| v == 0.0));
    }
}
