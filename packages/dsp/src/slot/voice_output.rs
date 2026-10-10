// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
//! What the voices of a slot hand over before the insert chain, in one of three shapes:
//! one channel for a mono voice; left and right for a stereo instrument
//! (`Voice::STEREO`, the choir's spread); mid and side for a voice whose width is
//! optional (`Voice::render_mid_side`: the spread VA fan, the strings ensemble,
//! the epiano autopan). The first (or only) channel is the slot's `signal`; this keeps
//! the second. A wide voice that writes no side in a block is mono in that block, so a
//! text without the width renders as before.
//!
//! Into the insert chain a stereo instrument is folded to `(L + R) ÷ 2` first, and a
//! mid/side voice passes its side along (the chain takes left = mid + side and
//! right = mid − side). Without effects a mid/side block is folded to left and right by
//! `fold_mid_side`.
//!
//! Both channels leave through a one-pole DC blocker at 5 Hz: no voice hands an offset to the inserts, the mix or the limiter.
use super::BLOCK;
use crate::instruments::InstrumentState;
use crate::math::DcBlocker;
use crate::voice::Params;

/// How the current sub-block left the voices.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Channels {
    Mono,
    LeftRight,
    MidSide,
}

pub struct VoiceOutput {
    /// The right channel (`LeftRight`) or the side signal (`MidSide`).
    second: [f32; BLOCK],
    stereo_instrument: bool,
    channels: Channels,
    /// Peak of the side signal in the current sub-block (0 unless `MidSide`).
    side_peak: f32,
    /// The DC blockers of the first and second channel, and their pole.
    blockers: [DcBlocker; 2],
    pole: f32,
}

impl VoiceOutput {
    pub fn new(stereo_instrument: bool, sample_rate: f32) -> Self {
        VoiceOutput {
            second: [0.0; BLOCK],
            stereo_instrument,
            channels: Channels::Mono,
            side_peak: 0.0,
            blockers: [DcBlocker::default(); 2],
            pole: DcBlocker::coefficient(sample_rate),
        }
    }

    /// Renders the voices into `first[range]` and the second channel; returns the number
    /// of sounding voices.
    pub fn render(
        &mut self,
        instrument: &mut InstrumentState,
        first: &mut [f32; BLOCK],
        offset: usize,
        len: usize,
        params: &Params,
    ) -> u32 {
        let range = offset..offset + len;
        first[range.clone()].fill(0.0);
        self.second[range.clone()].fill(0.0);
        self.side_peak = 0.0;
        if self.stereo_instrument {
            self.channels = Channels::LeftRight;
            let voices = instrument.render_stereo(
                &mut first[range.clone()],
                &mut self.second[range.clone()],
                params,
            );
            self.block_dc(first, offset, len);
            return voices;
        }
        let voices = instrument.render_mid_side(
            &mut first[range.clone()],
            &mut self.second[range.clone()],
            params,
        );
        self.block_dc(first, offset, len);
        self.side_peak = peak_of(&self.second[range]);
        self.channels = if self.side_peak != 0.0 {
            Channels::MidSide
        } else {
            Channels::Mono
        };
        voices
    }

    /// Takes the offset out of both channels of the sub-block.
    fn block_dc(&mut self, first: &mut [f32; BLOCK], offset: usize, len: usize) {
        let range = offset..offset + len;
        self.blockers[0].process(&mut first[range.clone()], self.pole);
        self.blockers[1].process(&mut self.second[range], self.pole);
    }

    /// Largest absolute sample of the first channel, or of both channels for a stereo
    /// instrument (`first` is the slot's signal).
    pub fn peak(&self, first: &[f32; BLOCK], offset: usize, len: usize) -> f32 {
        let first_peak = peak_of(&first[offset..offset + len]);
        if self.channels == Channels::LeftRight {
            first_peak.max(peak_of(&self.second[offset..offset + len]))
        } else {
            first_peak
        }
    }

    /// Peak of the side signal of a mid/side sub-block (0 otherwise).
    pub fn side_peak(&self) -> f32 {
        self.side_peak
    }

    /// Folds a stereo-instrument sub-block into `first` as `(L + R) ÷ 2`, the insert
    /// chain's input. A mid/side or mono sub-block is left as it is.
    pub fn fold_into(&mut self, first: &mut [f32; BLOCK], offset: usize, len: usize) {
        if self.channels != Channels::LeftRight {
            return;
        }
        for (l, r) in first[offset..offset + len]
            .iter_mut()
            .zip(&self.second[offset..offset + len])
        {
            *l = 0.5 * (*l + r);
        }
        self.channels = Channels::Mono;
    }

    /// The right channel of the sub-block when a stereo instrument left it in stereo.
    pub fn right(&self, offset: usize, len: usize) -> Option<&[f32]> {
        (self.channels == Channels::LeftRight).then(|| &self.second[offset..offset + len])
    }

    /// The side signal of the sub-block when a wide voice wrote one.
    pub fn side(&self, offset: usize, len: usize) -> Option<&[f32]> {
        (self.channels == Channels::MidSide).then(|| &self.second[offset..offset + len])
    }

    /// Silences the second channel (NaN recovery, stop).
    pub fn clear(&mut self) {
        self.second = [0.0; BLOCK];
        self.channels = Channels::Mono;
        self.side_peak = 0.0;
        self.blockers = [DcBlocker::default(); 2];
    }
}

/// Writes `left` and `right` from `mid` and `side` (all the same length) and returns the
/// louder channel's peak. A non-finite `side_peak` (the side buffer's) makes the result
/// NaN, so the slot clears the block.
pub fn fold_mid_side(
    mid: &[f32],
    side: &[f32],
    side_peak: f32,
    left: &mut [f32],
    right: &mut [f32],
) -> f32 {
    let mut peak = 0.0_f32;
    for n in 0..mid.len() {
        left[n] = mid[n] + side[n];
        right[n] = mid[n] - side[n];
        peak = peak.max(left[n].abs()).max(right[n].abs());
    }
    if side_peak.is_finite() {
        peak
    } else {
        f32::NAN
    }
}

/// Loudest absolute sample of `signal` (0 for silence).
fn peak_of(signal: &[f32]) -> f32 {
    signal.iter().fold(0.0_f32, |max, x| max.max(x.abs()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_fold_puts_the_side_on_opposite_channels() {
        let (mut left, mut right) = ([0.0; 2], [0.0; 2]);
        let peak = fold_mid_side(&[0.5, 0.25], &[0.25, -0.5], 0.5, &mut left, &mut right);
        assert_eq!(left, [0.75, -0.25]);
        assert_eq!(right, [0.25, 0.75]);
        assert_eq!(peak, 0.75);
    }

    #[test]
    fn a_non_finite_side_makes_the_peak_non_finite() {
        let (mut left, mut right) = ([0.0; 1], [0.0; 1]);
        let peak = fold_mid_side(&[0.5], &[0.1], f32::INFINITY, &mut left, &mut right);
        assert!(peak.is_nan());
    }
}
