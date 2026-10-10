// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The per-track level meter after `gain` and before `pan`/sends (`untzel_slot_levels`),
//! and the signal a slot hands to the mix. Separate from the slot's lifecycle and from
//! the insert/modulator message handler: this reads the slot's output, it never drives a
//! voice or an effect.

use super::Slot;

/// Running sums of the level meter since the last read.
#[derive(Clone, Copy, Default, Debug, PartialEq)]
pub struct Levels {
    pub sum_squares: f64,
    pub frames: f64,
    pub peak: f64,
}

/// The signal a slot hands to the mix, before gain.
#[derive(Clone, Copy)]
pub enum SlotOutput<'a> {
    Mono(&'a [f32]),
    Stereo(&'a [f32], &'a [f32]),
}

impl SlotOutput<'_> {
    /// `(L + R) ÷ 2` with effects (the sidechain and the meter read this).
    #[inline]
    pub fn mono_at(self, n: usize) -> f32 {
        match self {
            SlotOutput::Mono(x) => x[n],
            SlotOutput::Stereo(l, r) => (l[n] + r[n]) * 0.5,
        }
    }
}

impl Slot {
    /// Adds the sub-block to the level meter: the output times `gain × audible`, before
    /// pan ((L + R) ÷ 2 with effects).
    pub fn meter(&mut self, offset: usize, len: usize) {
        let gain = self.params.output_gain();
        let mut sum = 0.0_f64;
        let mut peak = self.levels.peak;
        for n in 0..len {
            let y = f64::from(self.output(offset, len).mono_at(n) * gain.at(n));
            sum += y * y;
            peak = peak.max(y.abs());
        }
        self.levels.sum_squares += sum;
        self.levels.frames += len as f64;
        self.levels.peak = peak;
    }

    /// Returns the level sums since the last call and starts new ones.
    pub fn take_levels(&mut self) -> Levels {
        core::mem::take(&mut self.levels)
    }
}
