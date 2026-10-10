// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Contract every `instruments/<name>/voice.rs` implements.

use crate::engines::sampler::SamplePack;

/// Per-sample smoothed parameters of one sub-block, by local instrument parameter index
/// (the generated constants, for example `instruments::bass::CUTOFF`).
pub struct Params<'a> {
    /// Value at the first sample of the sub-block.
    pub start: &'a [f32],
    /// Increment per sample within the sub-block.
    pub step: &'a [f32],
}

impl Params<'_> {
    #[inline]
    pub fn at(&self, index: usize, n: usize) -> f32 {
        self.start[index] + self.step[index] * n as f32
    }

    /// A choice parameter (`wave`) as an index in `0..count`. Choices never ramp, so the
    /// start value is the value of the whole sub-block.
    #[inline]
    pub fn choice(&self, index: usize, count: usize) -> usize {
        let value = self.start[index];
        if value.is_finite() && value > 0.0 {
            (value.round() as usize).min(count.saturating_sub(1))
        } else {
            0
        }
    }
}

/// Frames of the longest sub-block a voice renders (the render quantum).
pub const MAX_RENDER_FRAMES: usize = 128;

/// One voice of an instrument. `gain`, `pan`, sends and `duck` are applied by the slot,
/// not here. Must not allocate in `trigger`, `render`, `legato`, `steal` or `reset`.
pub trait Voice {
    /// A stereo voice is rendered with `render_stereo` and its slot keeps two channels;
    /// every other voice is mono (`render`).
    const STEREO: bool = false;

    /// Runs in the message handler: may allocate (delay lines), never in render.
    fn new(sample_rate: f32) -> Self;

    /// `note` is midi, or -1 for a hit.
    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params);

    /// Adds the voice into `out` (mono). Returns false when the voice is silent.
    fn render(&mut self, out: &mut [f32], params: &Params) -> bool;

    /// Adds the voice into `left` and `right` (at most `MAX_RENDER_FRAMES`). Default: the
    /// mono render, centred.
    fn render_stereo(&mut self, left: &mut [f32], right: &mut [f32], params: &Params) -> bool {
        let mut mono = [0.0_f32; MAX_RENDER_FRAMES];
        let len = left.len().min(right.len()).min(MAX_RENDER_FRAMES);
        let sounding = self.render(&mut mono[..len], params);
        for ((l, r), x) in left.iter_mut().zip(right.iter_mut()).zip(&mono[..len]) {
            *l += x;
            *r += x;
        }
        sounding
    }

    /// A voice whose width is optional (the spread VA fan, the strings
    /// ensemble, the epiano autopan) adds its mid signal into `mid` and its side signal
    /// into `side`, so left = mid + side and right = mid − side. A voice that writes
    /// nothing into `side` stays mono, so a text without the width renders as before.
    /// Default: `render`.
    fn render_mid_side(&mut self, mid: &mut [f32], side: &mut [f32], params: &Params) -> bool {
        let _ = side;
        self.render(mid, params)
    }

    /// Sample-based voices: the pack the next notes play, or None to stay on synthesis.
    /// Called in the message handler or between sub-blocks; never allocates. Default:
    /// ignored.
    fn use_samples(&mut self, pack: Option<&'static SamplePack>) {
        let _ = pack;
    }

    /// One-voice instruments: a new note while this one still holds. Moves the pitch to
    /// `note` in `glide_frames` (0 = jump) and, with `retrigger` false, keeps the
    /// envelopes running (legato). Default: a plain trigger.
    fn legato(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        glide_frames: u32,
        retrigger: bool,
        params: &Params,
    ) {
        let _ = (glide_frames, retrigger);
        self.trigger(note, velocity, duration_frames, params);
    }

    /// The pool takes this voice away (voice limit): fade out in about 2 ms.
    fn steal(&mut self) {}

    /// Current output level, 0..1, for the "released-quietest" policy.
    fn level(&self) -> f32 {
        1.0
    }

    /// Whether the voice is past its gate (note-off).
    fn is_released(&self) -> bool {
        false
    }

    /// Silences the voice and clears its state IN PLACE. Runs on the audio thread (NaN
    /// recovery, end of a retiring slot, end of a stop fade), so it must not allocate or
    /// free. The default rebuilds the voice and is only correct for a voice whose `new`
    /// allocates nothing; a voice that owns a delay line overrides it with `fill(0.0)`.
    fn reset(&mut self, sample_rate: f32)
    where
        Self: Sized,
    {
        *self = Self::new(sample_rate);
    }
}
