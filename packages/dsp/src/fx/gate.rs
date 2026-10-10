// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Idle detection of a shared bus: with no input and output below −90 dBFS for the
//! hold time, the bus stops being processed until it receives input again.

use crate::math::SILENCE;

pub struct BusGate {
    silent_frames: u32,
    hold_frames: u32,
}

impl BusGate {
    /// `hold_frames` covers 100 ms plus the longest delay inside the bus, so a tail
    /// still travelling through a line is never cut.
    pub fn new(hold_frames: u32) -> Self {
        BusGate {
            silent_frames: hold_frames,
            hold_frames,
        }
    }

    /// Whether the bus must be processed for a sub-block with this input.
    pub fn is_open(&mut self, input_has_signal: bool) -> bool {
        if input_has_signal {
            self.silent_frames = 0;
        }
        self.silent_frames < self.hold_frames
    }

    /// Records the output of a processed sub-block.
    pub fn observe(&mut self, input_has_signal: bool, output_peak: f32, frames: u32) {
        if input_has_signal || output_peak >= SILENCE {
            self.silent_frames = 0;
        } else {
            self.silent_frames = self.silent_frames.saturating_add(frames);
        }
    }

    /// Closed, as after a stop.
    pub fn close(&mut self) {
        self.silent_frames = self.hold_frames;
    }

    pub fn set_hold(&mut self, hold_frames: u32) {
        self.hold_frames = hold_frames;
    }
}

/// Whether any sample of the channels is non-zero.
#[inline]
pub fn has_signal(channels: [&[f32]; 2]) -> bool {
    channels
        .iter()
        .any(|channel| channel.iter().any(|&sample| sample != 0.0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closes_after_the_hold_and_reopens_on_input() {
        let mut gate = BusGate::new(256);
        assert!(!gate.is_open(false), "starts closed");
        assert!(gate.is_open(true));
        gate.observe(true, 0.5, 128);
        gate.observe(false, 0.0, 128);
        assert!(gate.is_open(false));
        gate.observe(false, 0.0, 128);
        assert!(!gate.is_open(false));
        assert!(gate.is_open(true));
    }
}
