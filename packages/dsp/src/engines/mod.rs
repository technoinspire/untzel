// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Shared synthesis engines. An instrument voice
//! composes the blocks of one engine and maps its manifest parameters onto them; no
//! engine knows a preset or an instrument. Every block depends only on `crate::math`.
//!
//! Rules of every block: `new` may allocate (message handler), nothing else does;
//! `reset` clears in place; filters stay stable for any cutoff in `[10 Hz, 0.45 sr]`
//! moving every sample; no `sin`/`cos` per sample.

pub mod additive;
pub mod ensemble;
pub mod env;
pub mod fm;
pub mod formant;
pub mod modal;
pub mod percussion;
pub mod sampler;
pub mod skin;
pub mod string;
pub mod va;
pub mod wash;

/// Output of a voice is limited to ±4 before the track gain.
pub const OUTPUT_LIMIT: f32 = 4.0;

/// Clamps a voice sample to `±OUTPUT_LIMIT` (NaN stays NaN: the slot detects it).
#[inline]
pub fn limit(x: f32) -> f32 {
    x.clamp(-OUTPUT_LIMIT, OUTPUT_LIMIT)
}

/// Midi note of a hit (`x`) for pitched engines: `c3`.
pub const HIT_NOTE: f32 = 48.0;

/// The note a voice plays: a hit becomes `HIT_NOTE`, anything else is clamped to 0..127.
#[inline]
pub fn played_note(note: f32) -> f32 {
    if note < 0.0 {
        HIT_NOTE
    } else {
        note.min(127.0)
    }
}

/// Semitones to a frequency ratio.
#[inline]
pub fn semitones(value: f32) -> f32 {
    (value * (core::f32::consts::LN_2 / 12.0)).exp()
}

/// `2^x` for per-sample modulation, relative error under 2e-4 for |x| < 30 (much
/// cheaper than `exp`). Exact functions stay in per-block code.
#[inline]
pub fn fast_exp2(x: f32) -> f32 {
    let x = x.clamp(-30.0, 30.0);
    let floor = x.floor();
    let f = x - floor;
    // Minimax-style cubic for 2^f on [0, 1).
    let p = 1.0 + f * (0.696_065_6 + f * (0.224_494_34 + f * 0.079_440_24));
    p * f32::from_bits(((floor as i32 + 127) as u32) << 23)
}

/// `semitones` for per-sample use.
#[inline]
pub fn fast_semitones(value: f32) -> f32 {
    fast_exp2(value / 12.0)
}

/// Portamento in semitones, linear over a number of frames.
#[derive(Clone, Copy, Default)]
pub struct Glide {
    current: f32,
    target: f32,
    step: f32,
    left: u32,
}

impl Glide {
    /// Jumps to `note`.
    pub fn set(&mut self, note: f32) {
        self.current = note;
        self.target = note;
        self.step = 0.0;
        self.left = 0;
    }

    /// Moves to `note` over `frames` (0 jumps).
    pub fn glide_to(&mut self, note: f32, frames: u32) {
        if frames == 0 {
            self.set(note);
            return;
        }
        self.target = note;
        self.left = frames;
        self.step = (note - self.current) / frames as f32;
    }

    /// Current note, advancing one frame.
    #[inline]
    pub fn tick(&mut self) -> f32 {
        if self.left > 0 {
            self.left -= 1;
            self.current = if self.left == 0 {
                self.target
            } else {
                self.current + self.step
            };
        }
        self.current
    }

    #[inline]
    pub fn note(&self) -> f32 {
        self.current
    }

    /// The note the glide ends on.
    pub fn target(&self) -> f32 {
        self.target
    }

    #[inline]
    pub fn is_gliding(&self) -> bool {
        self.left > 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fast_exp2_tracks_exp2() {
        for i in -2000..2000 {
            let x = i as f32 * 0.01;
            let exact = x.exp2();
            assert!(((fast_exp2(x) - exact) / exact).abs() < 2e-4, "{x}");
        }
    }
}
