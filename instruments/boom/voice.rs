// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `boom`: a long tuned sine with a falling pitch at the start and optional
//! saturation (`color`): the long kick-bass of trap and bass music. Plays notes.

use crate::engines::env::{Adsr, AdsrTimes};
use crate::engines::percussion::Tone;
use crate::engines::{limit, played_note};
use crate::math::{midi_to_hz, saturate};
use crate::voice::{Params, Voice};

const LEVEL: f32 = 0.8453;

/// The tone's own decay is not used: the ADSR shapes the note.
const HOLD_SECONDS: f32 = 1.0e6;

pub struct BoomVoice {
    sample_rate: f32,
    tone: Tone,
    amp: Adsr,
}

fn times(params: &Params) -> AdsrTimes {
    AdsrTimes { attack: 0.001, decay: params.at(super::DECAY, 0), sustain: 0.0, release: 0.08 }
}

impl Voice for BoomVoice {
    fn new(sample_rate: f32) -> Self {
        BoomVoice { sample_rate, tone: Tone::new(), amp: Adsr::new(sample_rate) }
    }

    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        // `tune` shifts the written note by up to ±6 semitones.
        let tune = (params.at(super::TUNE, 0) - 0.5) * 12.0;
        let hz = midi_to_hz(played_note(note) + tune);
        let start = hz * (1.0 + 3.0 * params.at(super::BEND, 0));
        self.tone.trigger(start, hz, 0.03, 1.0, HOLD_SECONDS, self.sample_rate);
        self.amp.trigger(velocity, duration_frames.max((0.05 * self.sample_rate) as u32), times(params));
    }

    fn legato(&mut self, note: f32, velocity: f32, duration_frames: u32, _glide: u32, retrigger: bool, params: &Params) {
        let tune = (params.at(super::TUNE, 0) - 0.5) * 12.0;
        self.tone.glide_to(midi_to_hz(played_note(note) + tune));
        if retrigger {
            self.trigger(note, velocity, duration_frames, params);
        } else {
            self.amp.extend(velocity, duration_frames);
        }
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        if !self.amp.is_active() {
            return false;
        }
        self.amp.set_times(times(params));
        let color = params.at(super::COLOR, 0);
        for sample in out.iter_mut() {
            let tone = saturate(self.tone.next(self.sample_rate), color, 6.0);
            *sample += limit(tone * self.amp.tick() * LEVEL);
        }
        self.amp.is_active()
    }

    fn steal(&mut self) {
        self.amp.steal();
    }

    fn level(&self) -> f32 {
        self.amp.level()
    }

    fn is_released(&self) -> bool {
        self.amp.is_released()
    }
}
