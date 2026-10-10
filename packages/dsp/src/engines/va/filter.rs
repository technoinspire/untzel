// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The VA filter of one channel (a 12 dB state-variable or a 24 dB ladder, plus the
//! low cut under the fundamental) and the settings it takes for one block.

use super::controls::FilterMode;
use super::ladder::Ladder;
use crate::math::Svf;

/// A band-pass or a high-pass removes most of a saw's energy; this brings the voice
/// back near its low-pass level (pnpm sim --levels).
const BANDPASS_GAIN: f32 = 4.0;
const HIGHPASS_GAIN: f32 = 2.8;
/// Level around which the SVF's band integrator saturates.
const SVF_HEADROOM: f32 = 3.0;

/// What the filters keep for one block: the mode, the side's mode, the level
/// compensation and the resonance as the SVF's damping `k` and as the ladder's amount.
#[derive(Clone, Copy)]
pub struct FilterSetup {
    pub mode: FilterMode,
    /// The side of a stereo fan goes through the 12 dB filter even under the ladder: the
    /// width needs the same cutoff, not the same slope, at a fraction of the cost.
    pub side_mode: FilterMode,
    pub gain: f32,
    pub k: f32,
    pub resonance: f32,
}

impl FilterSetup {
    pub fn new(mode: FilterMode, resonance: f32) -> Self {
        let side_mode = if mode == FilterMode::Lowpass24 {
            FilterMode::Lowpass12
        } else {
            mode
        };
        let gain = match mode {
            FilterMode::Bandpass => BANDPASS_GAIN,
            FilterMode::Highpass => HIGHPASS_GAIN,
            FilterMode::Lowpass12 | FilterMode::Lowpass24 => 1.0,
        };
        FilterSetup {
            mode,
            side_mode,
            gain,
            k: 2.0 - 1.9 * resonance,
            resonance,
        }
    }
}

/// One filter per channel: the mid and, for a stereo fan, the side.
#[derive(Clone, Copy, Default)]
pub struct Filter {
    svf: Svf,
    ladder: Ladder,
    low_cut: Svf,
}

impl Filter {
    #[inline]
    pub fn process(&mut self, input: f32, mode: FilterMode, g: f32, setup: &FilterSetup) -> f32 {
        match mode {
            FilterMode::Lowpass12 => {
                self.svf
                    .process_saturated(input, g, setup.k, SVF_HEADROOM)
                    .low
            }
            FilterMode::Lowpass24 => self.ladder.process(input, g, setup.resonance),
            FilterMode::Bandpass => {
                self.svf
                    .process_saturated(input, g, setup.k, SVF_HEADROOM)
                    .band
            }
            FilterMode::Highpass => {
                self.svf
                    .process_saturated(input, g, setup.k, SVF_HEADROOM)
                    .high
            }
        }
    }

    /// The high-pass under the fundamental (`low-cut`), with its gain `g`.
    #[inline]
    pub fn cut_lows(&mut self, input: f32, g: f32) -> f32 {
        self.low_cut.process(input, g, 1.4).high
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_side_never_takes_the_ladder_and_band_modes_are_compensated() {
        let ladder = FilterSetup::new(FilterMode::Lowpass24, 0.5);
        assert_eq!(ladder.side_mode, FilterMode::Lowpass12);
        assert_eq!(ladder.gain, 1.0);
        assert!((ladder.k - 1.05).abs() < 1e-6);
        assert_eq!(
            FilterSetup::new(FilterMode::Bandpass, 0.0).gain,
            BANDPASS_GAIN
        );
        assert_eq!(
            FilterSetup::new(FilterMode::Highpass, 0.0).side_mode,
            FilterMode::Highpass
        );
    }
}
