// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! `chorus`: a bucket-brigade ensemble after the chorus of the 1982 Juno-60 polysynth,
//! measured by the MIT-licensed analysis at github.com/pendragon-andyh/Juno60.
//! The mono sum goes through a 12 dB low-pass and a soft clip (the BBD's input filter
//! and its rounding), into one delay line that two taps read, swept by one triangle LFO
//! between 1.66 and 5.35 ms, the right tap in opposite phase. Each side adds its tap to
//! its dry signal, so the centre stays put and the width moves. The line
//! (`ceil(0.006 × sample rate) + 2` samples) is allocated in `new` and zeroed in place by
//! `reset`.

use crate::math::{Svf, advance_phase, filter_gain, soft_clip};

const MIN_DELAY_SECONDS: f32 = 0.00166;
const MAX_DELAY_SECONDS: f32 = 0.00535;
const LINE_SECONDS: f32 = 0.006;
/// The BBD's input filter, Hz, and its damping (a gentle 12 dB slope).
const BBD_CUTOFF_HZ: f32 = 8_000.0;
const BBD_DAMPING: f32 = 1.4;
/// Level of the BBD input at which it starts to round off.
const BBD_HEADROOM: f32 = 1.5;
/// At `chorus 1` the dry keeps this much and each tap adds this much.
const DRY_AT_FULL: f32 = 0.75;
const WET_AT_FULL: f32 = 0.7;

pub struct Chorus {
    sample_rate: f32,
    line: Box<[f32]>,
    write: usize,
    phase: f32,
    input_filter: Svf,
    filter_gain: f32,
}

impl Chorus {
    pub fn new(sample_rate: f32) -> Self {
        let length = (LINE_SECONDS * sample_rate).ceil() as usize + 2;
        Chorus {
            sample_rate,
            line: vec![0.0; length].into_boxed_slice(),
            write: 0,
            phase: 0.0,
            input_filter: Svf::default(),
            filter_gain: filter_gain(BBD_CUTOFF_HZ, sample_rate),
        }
    }

    /// The line read `seconds` behind the write position, linearly interpolated.
    #[inline]
    fn tap(&self, seconds: f32) -> f32 {
        let length = self.line.len();
        let delay = (seconds * self.sample_rate).min((length - 2) as f32);
        let whole = delay.floor();
        let fraction = delay - whole;
        let whole = whole as usize;
        let a = self.line[(self.write + length - whole) % length];
        let b = self.line[(self.write + length - whole - 1) % length];
        a + fraction * (b - a)
    }

    #[inline]
    pub fn process(&mut self, input: [f32; 2], amount: f32, rate_hz: f32) -> [f32; 2] {
        self.phase = advance_phase(self.phase, (rate_hz / self.sample_rate).min(0.45));
        let triangle = 1.0 - 2.0 * (self.phase - 0.5).abs();
        let mono = 0.5 * (input[0] + input[1]);
        let filtered = self
            .input_filter
            .process(mono, self.filter_gain, BBD_DAMPING)
            .low;
        self.line[self.write] = BBD_HEADROOM * soft_clip(filtered / BBD_HEADROOM);
        let span = MAX_DELAY_SECONDS - MIN_DELAY_SECONDS;
        let left = self.tap(MIN_DELAY_SECONDS + span * triangle);
        let right = self.tap(MIN_DELAY_SECONDS + span * (1.0 - triangle));
        self.write = (self.write + 1) % self.line.len();
        let mix = amount.clamp(0.0, 1.0);
        let dry = 1.0 - (1.0 - DRY_AT_FULL) * mix;
        let wet = WET_AT_FULL * mix;
        [input[0] * dry + left * wet, input[1] * dry + right * wet]
    }

    /// Zeroes the line in place: no allocation on the audio thread.
    pub fn reset(&mut self) {
        self.line.fill(0.0);
        self.write = 0;
        self.phase = 0.0;
        self.input_filter = Svf::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_taps_stay_inside_the_juno_range_and_a_dry_chorus_is_the_input() {
        let mut chorus = Chorus::new(48_000.0);
        for n in 0..48_000 {
            let x = if n % 480 == 0 { 1.0 } else { 0.0 };
            let [l, r] = chorus.process([x, x], 0.0, 0.6);
            assert_eq!([l, r], [x, x]);
        }
        let mut chorus = Chorus::new(48_000.0);
        let out: Vec<[f32; 2]> = (0..96_000)
            .map(|n| chorus.process([if n == 0 { 1.0 } else { 0.0 }; 2], 1.0, 0.6))
            .collect();
        // The impulse comes back on both sides between 1.66 and 5.35 ms, and nowhere later.
        let first_echo = out
            .iter()
            .skip(1)
            .position(|s| s[0].abs() > 1e-3)
            .map(|p| p + 1);
        assert!(
            matches!(first_echo, Some(p) if (79..=258).contains(&p)),
            "{first_echo:?}"
        );
        assert!(
            out[400..]
                .iter()
                .all(|s| s[0].abs() < 1e-3 && s[1].abs() < 1e-3)
        );
    }
}
