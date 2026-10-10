// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! A string ensemble: three taps of one short delay line, each swept
//! by its own phase of a slow and a fast LFO 120° apart (the bucket-brigade ensembles of
//! string machines), spread left, right and centre. It turns a voice's beating into
//! width. The delay line is allocated in `new` (message handler) and cleared in place.

use crate::math::{advance_phase, sine};

/// Longest delay the taps reach, in samples at 48 kHz and above (rounded up to a power
/// of two at `new`).
const LINE_SECONDS: f32 = 0.02;
const CENTRE_SECONDS: f32 = 0.007;
const SLOW_SECONDS: f32 = 0.0025;
const FAST_SECONDS: f32 = 0.0004;
const SLOW_HZ: f32 = 0.63;
const FAST_HZ: f32 = 6.1;
const THIRD: f32 = 1.0 / 3.0;

pub struct Ensemble {
    sample_rate: f32,
    line: Box<[f32]>,
    mask: usize,
    write: usize,
    slow: f32,
    fast: f32,
}

impl Ensemble {
    /// Message handler only: allocates the line.
    pub fn new(sample_rate: f32) -> Self {
        let length = ((LINE_SECONDS * sample_rate) as usize)
            .next_power_of_two()
            .max(64);
        Ensemble {
            sample_rate,
            line: vec![0.0; length].into_boxed_slice(),
            mask: length - 1,
            write: 0,
            slow: 0.0,
            fast: 0.0,
        }
    }

    #[inline]
    fn tap(&self, seconds: f32) -> f32 {
        let delay = (seconds * self.sample_rate).clamp(1.0, self.mask as f32 - 1.0);
        let whole = delay as usize;
        let fraction = delay - whole as f32;
        let a = self.line[(self.write + self.mask + 1 - whole) & self.mask];
        let b = self.line[(self.write + self.mask - whole) & self.mask];
        a + fraction * (b - a)
    }

    /// The three tap delays (seconds) at the current LFO phases.
    fn delays(&self) -> [f32; 3] {
        core::array::from_fn(|index| {
            let offset = index as f32 * THIRD;
            let slow = sine((self.slow + offset) % 1.0);
            let fast = sine((self.fast + offset) % 1.0);
            CENTRE_SECONDS + SLOW_SECONDS * slow + FAST_SECONDS * fast
        })
    }

    /// One block: `amount` (0..1) crossfades the dry input into the three taps; the mid
    /// and side are added into `mid` and `side`. The LFOs move per block, the delays glide
    /// linearly inside it (no `sin` per sample).
    pub fn process_block(&mut self, input: &[f32], amount: f32, mid: &mut [f32], side: &mut [f32]) {
        let frames = input.len().max(1) as f32;
        let start = self.delays();
        self.slow = advance_phase(self.slow, SLOW_HZ * frames / self.sample_rate);
        self.fast = advance_phase(self.fast, (FAST_HZ * frames / self.sample_rate).min(0.49));
        let end = self.delays();
        let step: [f32; 3] = core::array::from_fn(|i| (end[i] - start[i]) / frames);
        for (n, &x) in input.iter().enumerate() {
            self.line[self.write] = x;
            let at = |i: usize| self.tap(start[i] + step[i] * n as f32);
            let taps = [at(0), at(1), at(2)];
            self.write = (self.write + 1) & self.mask;
            let wet_mid = (taps[0] + taps[1] + taps[2]) * THIRD;
            mid[n] += x + amount * (wet_mid - x);
            side[n] += amount * 0.5 * (taps[0] - taps[1]);
        }
    }

    /// Clears the line in place (audio thread: no allocation).
    pub fn reset(&mut self) {
        self.line.fill(0.0);
        self.write = 0;
        self.slow = 0.0;
        self.fast = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_amount_is_the_dry_signal_and_some_amount_makes_width() {
        let mut ensemble = Ensemble::new(48_000.0);
        let input: Vec<f32> = (0..48_000)
            .map(|n| sine((n as f32 * 220.0 / 48_000.0) % 1.0))
            .collect();
        let (mut mid, mut side) = (vec![0.0; 48_000], vec![0.0; 48_000]);
        for ((x, m), s) in input
            .chunks(128)
            .zip(mid.chunks_mut(128))
            .zip(side.chunks_mut(128))
        {
            ensemble.process_block(x, 0.0, m, s);
        }
        assert_eq!(mid, input);
        assert!(side.iter().all(|x| *x == 0.0));
        ensemble.reset();
        let (mut mid, mut side) = (vec![0.0; 48_000], vec![0.0; 48_000]);
        for ((x, m), s) in input
            .chunks(128)
            .zip(mid.chunks_mut(128))
            .zip(side.chunks_mut(128))
        {
            ensemble.process_block(x, 1.0, m, s);
        }
        assert!(mid.iter().all(|x| x.is_finite() && x.abs() <= 1.01));
        let side_energy: f32 = side.iter().map(|x| x * x).sum();
        assert!(side_energy > 100.0, "{side_energy}");
    }
}
