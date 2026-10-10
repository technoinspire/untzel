// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
//! The recorded half of a percussion instrument: conga,
//! bongo, cowbell, woodblock, shaker, clap and hat play their VCSL hit when `source` is
//! `samples` and the pack has arrived, and their synthesis otherwise. A hit is a one-shot:
//! the recording plays at once and dies away over the instrument's own `decay`, past the
//! step's note-off, so a 1/16 step never cuts a ringing drum.
use super::{Recorded, SamplePack, SamplerControls, SamplerPatch};
use crate::engines::env::AdsrTimes;

/// What one hit asks of the recording.
#[derive(Clone, Copy)]
pub struct Hit {
    /// Which recording: 0 and 1 are the two sounds of the pack (open and slap, closed and open…).
    pub position: f32,
    /// The pitch the zone is read at (its root plays unshifted).
    pub note: f32,
    pub velocity: f32,
    /// Seconds the hit takes to die away.
    pub decay: f32,
    /// The recording's tone: below 0.5 a lowpass darkens it, above it the tilt brightens it.
    pub brightness: f32,
}

pub struct RecordedHit {
    recorded: Recorded,
    controls: SamplerControls,
}

const NEUTRAL: SamplerControls = SamplerControls {
    vowel: 0.0,
    gain: 1.0,
    brightness: 0.5,
    detune: 0.0,
    times: AdsrTimes {
        attack: 0.0005,
        decay: 0.3,
        sustain: 0.0,
        release: 0.3,
    },
};

impl RecordedHit {
    pub fn new(sample_rate: f32, level: f32) -> Self {
        let patch = SamplerPatch {
            vibrato: 0.0,
            vibrato_hz: 0.0,
            stem_detune_cents: 0.0,
            level,
        };
        RecordedHit {
            recorded: Recorded::new(sample_rate, patch),
            controls: NEUTRAL,
        }
    }
    pub fn set_pack(&mut self, pack: Option<&'static SamplePack>) {
        self.recorded.set_pack(pack);
    }
    /// Plays `hit` on the recording when `wanted` and the pack is there; returns whether it
    /// did (the voice then silences its synthesis).
    pub fn trigger(&mut self, wanted: bool, hit: Hit, duration_frames: u32) -> bool {
        let decay = hit.decay.max(0.01);
        self.controls = SamplerControls {
            brightness: hit.brightness.clamp(0.0, 1.0),
            times: AdsrTimes {
                decay,
                release: decay,
                ..NEUTRAL.times
            },
            ..NEUTRAL
        };
        self.recorded.trigger(
            wanted,
            hit.position.clamp(0.0, 1.0),
            hit.note,
            hit.velocity,
            duration_frames,
            &self.controls,
        )
    }
    pub fn render(&mut self, out: &mut [f32]) -> bool {
        self.recorded.render(out, &self.controls)
    }
    pub fn is_sampled(&self) -> bool {
        self.recorded.is_sampled()
    }
    pub fn level(&self) -> f32 {
        self.recorded.level()
    }
    pub fn steal(&mut self) {
        self.recorded.steal();
    }
    pub fn reset(&mut self) {
        self.recorded.reset();
    }
}
