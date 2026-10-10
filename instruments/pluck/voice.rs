// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `pluck`: a plucked string (Karplus-Strong) with a picking position and a
//! small body resonance; guitar, banjo or muted pluck.
//! The delay lines are allocated in `new`; `reset` zeroes them in place, so the audio thread never allocates.

use crate::engines::string::{Body, KarplusString, StringControls, note_hz};
use crate::voice::{Params, Voice};

const STRINGS: usize = 1;
const LEVEL: f32 = 0.5404;

fn controls(params: &Params) -> StringControls {
    StringControls {
        brightness: params.at(super::BRIGHTNESS, 0),
        decay: params.at(super::DECAY, 0),
        position: params.at(super::POSITION, 0),
        body: params.at(super::BODY, 0),
        release: params.at(super::RELEASE, 0),
    }
}

/// Level of a pluck in decibels to add so its sounds stay close: a bright or long
/// string carries more energy. Fitted on `pnpm sim --levels` (brightness ≈ 7 dB per
/// unit; decay 1.2 dB per octave below 2.5 s, so a muted pluck keeps its headroom, and 1 dB per octave above).
fn level_compensation_db(brightness: f32, decay: f32) -> f32 {
    let octaves = (decay.max(0.05) / 2.5).log2();
    let decay_db = if octaves < 0.0 { -1.2 * octaves } else { -octaves };
    -7.0 * (brightness - 0.6) + decay_db
}

pub struct PluckVoice {
    sample_rate: f32,
    /// Linear gain from `level_compensation_db`, set at the pluck.
    gain: f32,
    strings: [KarplusString; STRINGS],
    body: Body,
    scratch: [f32; 128],
}

impl Voice for PluckVoice {
    fn new(sample_rate: f32) -> Self {
        PluckVoice {
            sample_rate,
            gain: 1.0,
            strings: core::array::from_fn(|index| KarplusString::new(sample_rate, 0x706c_7563 + index as u32)),
            body: Body::default(),
            scratch: [0.0; 128],
        }
    }

    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        let controls = controls(params);
        self.gain = (level_compensation_db(controls.brightness, controls.decay) * (core::f32::consts::LN_10 / 20.0)).exp();
        let hz = note_hz(note);
        let detune = 0.0;
        for (index, string) in self.strings.iter_mut().enumerate() {
            let cents = if index == 0 { 0.0 } else { 4.0 + 10.0 * detune };
            string.pluck(hz * (cents / 1200.0 * core::f32::consts::LN_2).exp(), velocity, duration_frames, &controls);
        }
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let controls = controls(params);
        let len = out.len().min(self.scratch.len());
        let scratch = &mut self.scratch[..len];
        scratch.fill(0.0);
        let mut sounding = false;
        for string in self.strings.iter_mut() {
            sounding |= string.render(scratch, LEVEL * self.gain / STRINGS as f32, &controls);
        }
        for (sample, &x) in out.iter_mut().zip(scratch.iter()) {
            *sample += self.body.process(x, controls.body, self.sample_rate, 180.0, 1_400.0);
        }
        sounding
    }

    fn steal(&mut self) {
        for string in self.strings.iter_mut() {
            string.steal();
        }
    }

    fn level(&self) -> f32 {
        self.strings.iter().map(KarplusString::level).fold(0.0, f32::max)
    }

    fn is_released(&self) -> bool {
        self.strings[0].is_released()
    }

    fn reset(&mut self, _sample_rate: f32) {
        for string in self.strings.iter_mut() {
            string.reset();
        }
        self.body.reset();
    }
}
