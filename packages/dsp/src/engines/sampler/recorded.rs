// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
//! The recorded half of an instrument that also has a synthesis engine: piano,
//! strings, harp, mallet, bell and kalimba play their pack when `source` is `samples` and
//! the pack has arrived, and their synthesis otherwise, so the music never waits for a
//! download. The pack's stems carry their own pan; the voice adds them as mid and side.
use super::{SamplePack, SamplerControls, SamplerCore, SamplerPatch};
use crate::math::{Svf, filter_gain};
use crate::voice::MAX_RENDER_FRAMES;

/// Below `brightness` 0.5 the recording goes through a lowpass from 20 kHz (0.5) down to
/// 500 Hz (0): felt piano, muted kalimba, dark strings. Above it the tilt lifts the highs.
const DARK_HZ: f32 = 500.0;
const OPEN_HZ: f32 = 20_000.0;
const TONE_DAMPING: f32 = 1.3;

pub struct Recorded {
    sampler: SamplerCore,
    /// The current note plays the recording.
    sampled: bool,
    /// The pack layer the note plays (`position`: velocity layer or sound of the instrument).
    position: f32,
    sample_rate: f32,
    tone: [Svf; 2],
}

impl Recorded {
    pub fn new(sample_rate: f32, patch: SamplerPatch) -> Self {
        Recorded {
            sampler: SamplerCore::new(sample_rate, patch),
            sampled: false,
            position: 0.0,
            sample_rate,
            tone: [Svf::default(); 2],
        }
    }

    pub fn set_pack(&mut self, pack: Option<&'static SamplePack>) {
        self.sampler.set_pack(pack);
    }

    /// Starts the note on the recording when `wanted` and the pack is there; returns
    /// whether it did (the voice then silences its synthesis). Otherwise lets a sounding
    /// recorded note go.
    pub fn trigger(
        &mut self,
        wanted: bool,
        position: f32,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        controls: &SamplerControls,
    ) -> bool {
        self.sampled = wanted && self.sampler.has_pack();
        self.position = position;
        if self.sampled {
            self.sampler
                .trigger(note, velocity, duration_frames, &self.layer(controls));
        } else if self.sampler.is_active() {
            self.sampler.steal();
        }
        self.sampled
    }

    pub fn is_sampled(&self) -> bool {
        self.sampled
    }

    /// Adds the recording into `out`, both stems at half level.
    pub fn render(&mut self, out: &mut [f32], controls: &SamplerControls) -> bool {
        let len = out.len().min(MAX_RENDER_FRAMES);
        let mut left = [0.0_f32; MAX_RENDER_FRAMES];
        let mut right = [0.0_f32; MAX_RENDER_FRAMES];
        let sounding = self.render_tone(&mut left[..len], &mut right[..len], controls);
        for n in 0..len {
            out[n] += 0.5 * (left[n] + right[n]);
        }
        sounding
    }

    /// Adds the recording as mid (L + R) / 2 and side (L − R) / 2.
    pub fn render_mid_side(
        &mut self,
        mid: &mut [f32],
        side: &mut [f32],
        controls: &SamplerControls,
    ) -> bool {
        if !self.sampler.is_active() && self.sampler.level() <= 0.0 {
            return false;
        }
        let len = mid.len().min(side.len()).min(MAX_RENDER_FRAMES);
        let mut left = [0.0_f32; MAX_RENDER_FRAMES];
        let mut right = [0.0_f32; MAX_RENDER_FRAMES];
        let sounding = self.render_tone(&mut left[..len], &mut right[..len], controls);
        for n in 0..len {
            mid[n] += 0.5 * (left[n] + right[n]);
            side[n] += 0.5 * (left[n] - right[n]);
        }
        sounding
    }

    /// The recording of this block into `left` and `right` (cleared), through the tone filter.
    fn render_tone(
        &mut self,
        left: &mut [f32],
        right: &mut [f32],
        controls: &SamplerControls,
    ) -> bool {
        let layered = self.layer(controls);
        let sounding = self.sampler.render_stereo(left, right, &layered);
        let brightness = controls.brightness.clamp(0.0, 1.0);
        if brightness < 0.5 {
            let cutoff = DARK_HZ * (OPEN_HZ / DARK_HZ).powf(2.0 * brightness);
            let g = filter_gain(cutoff, self.sample_rate);
            for (channel, filter) in [left, right].into_iter().zip(self.tone.iter_mut()) {
                for x in channel.iter_mut() {
                    *x = filter.process(*x, g, TONE_DAMPING).low;
                }
            }
        }
        sounding
    }

    fn layer(&self, controls: &SamplerControls) -> SamplerControls {
        SamplerControls {
            vowel: self.position,
            ..*controls
        }
    }

    pub fn steal(&mut self) {
        self.sampler.steal();
    }

    pub fn level(&self) -> f32 {
        self.sampler.level()
    }

    pub fn is_released(&self) -> bool {
        self.sampler.is_released()
    }

    pub fn reset(&mut self) {
        self.sampler.reset();
        self.sampled = false;
        self.tone = [Svf::default(); 2];
    }
}
