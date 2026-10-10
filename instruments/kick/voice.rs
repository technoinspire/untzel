// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of the `kick` instrument: a sine with a falling pitch envelope (it starts
//! `1 + sweep` times above `pitch` and falls in `sweep-time`), a high-passed
//! noise click, an `overtone` (the body's octave, for a hollow, woody kick), `grit`
//! (the click's noise held by the body), saturation and `level`, the named sound's own
//! output trim (so every sound of the kick peaks alike), and the beater: a knock that falls from 5 kHz to 1.5 kHz in 4 ms and decays in 8 ms, the
//! beater on the head that makes a club kick cut through on a phone or a laptop. Parameter indices:
//! `super::<NAME>` (generated from manifest.json by packages/dsp/build.rs).

use crate::math::{
    Noise, SILENCE, advance_phase, decay_coefficient, one_pole_coefficient, saturate, sine,
};
use crate::voice::{Params, Voice};

const CLICK_SECONDS: f32 = 0.004;
const CLICK_LEVEL: f32 = 0.6;
/// The octave adds in phase near the body's crest: the peak of `sin x + a·sin 2x` grows
/// as about `1 + LINEAR·a + SQUARE·a²` (1.76 at `a = 1`, within 3% between). The body is
/// divided by it, so `overtone` changes the colour and not the peak.
const OVERTONE_PEAK_LINEAR: f32 = 0.388;
const OVERTONE_PEAK_SQUARE: f32 = 0.372;
const DRIVE_DEPTH: f32 = 6.0;
/// The beater's chirp: from `BEATER_LOW_HZ + BEATER_SPAN_HZ` down to `BEATER_LOW_HZ` in
/// `BEATER_SWEEP_SECONDS`, fading in `BEATER_SECONDS`; its level grows with `click`.
const BEATER_LOW_HZ: f32 = 1_500.0;
const BEATER_SPAN_HZ: f32 = 3_500.0;
const BEATER_SWEEP_SECONDS: f32 = 0.004;
const BEATER_SECONDS: f32 = 0.008;
const BEATER_LEVEL: f32 = 0.6;
/// The beater lands on the body's first crest: the whole kick is trimmed by about the
/// peak it adds, so every sound keeps the peak it had.
const BEATER_PEAK_SHARE: f32 = 0.6;

pub struct KickVoice {
    sample_rate: f32,
    phase: f32,
    level: f32,
    pitch_envelope: f32,
    pitch_coefficient: f32,
    click_envelope: f32,
    click_coefficient: f32,
    click_low: f32,
    click_low_coefficient: f32,
    noise: Noise,
    beater_phase: f32,
    beater_envelope: f32,
    beater_sweep: f32,
    beater_coefficient: f32,
    beater_sweep_coefficient: f32,
    /// 1 ÷ the peak the beater adds.
    beater_trim: f32,
}

impl Voice for KickVoice {
    fn new(sample_rate: f32) -> Self {
        KickVoice {
            sample_rate,
            phase: 0.0,
            level: 0.0,
            pitch_envelope: 0.0,
            pitch_coefficient: 0.0,
            click_envelope: 0.0,
            click_coefficient: (-1.0 / (CLICK_SECONDS * sample_rate)).exp(),
            click_low: 0.0,
            click_low_coefficient: 0.0,
            noise: Noise::new(0x6b69_636b),
            beater_phase: 0.0,
            beater_envelope: 0.0,
            beater_sweep: 0.0,
            beater_coefficient: (-1.0 / (BEATER_SECONDS * sample_rate)).exp(),
            beater_sweep_coefficient: (-1.0 / (BEATER_SWEEP_SECONDS * sample_rate)).exp(),
            beater_trim: 1.0,
        }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, _duration_frames: u32, params: &Params) {
        let sweep_seconds = params.at(super::SWEEP_TIME, 0);
        self.pitch_coefficient = (-1.0 / (sweep_seconds * self.sample_rate)).exp();
        // The click is noise high-passed at `click-tone` (1.5 kHz: a tick; low: a thud).
        let click_seconds = 1.0 / (core::f32::consts::TAU * params.at(super::CLICK_TONE, 0));
        self.click_low_coefficient = one_pole_coefficient(click_seconds, self.sample_rate);
        self.phase = 0.0;
        self.level = velocity;
        self.pitch_envelope = 1.0;
        self.click_envelope = velocity;
        self.beater_phase = 0.0;
        self.beater_sweep = 1.0;
        let beater = BEATER_LEVEL * (0.4 + 0.6 * params.at(super::CLICK, 0));
        self.beater_envelope = velocity * beater;
        self.beater_trim = 1.0 / (1.0 + BEATER_PEAK_SHARE * beater);
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let decay = decay_coefficient(params.at(super::DECAY, 0), self.sample_rate);
        let sweep = params.at(super::SWEEP, 0);
        let overtone = params.at(super::OVERTONE, 0);
        let grit = params.at(super::GRIT, 0);
        let overtone_peak =
            1.0 + overtone * (OVERTONE_PEAK_LINEAR + OVERTONE_PEAK_SQUARE * overtone);
        // The named sound's trim times the beater trim: the body gives back
        // the peak the beater adds.
        let trim = params.at(super::LEVEL, 0) * self.beater_trim;
        for (n, sample) in out.iter_mut().enumerate() {
            let frequency =
                params.at(super::PITCH, n) * (1.0 + sweep * self.pitch_envelope);
            self.phase = advance_phase(self.phase, frequency / self.sample_rate);
            let mut body = sine(self.phase) * self.level;
            if overtone > 0.0 {
                let octave = if self.phase < 0.5 { 2.0 * self.phase } else { 2.0 * self.phase - 1.0 };
                body = (body + overtone * sine(octave) * self.level) / overtone_peak;
            }
            let noise = self.noise.sample();
            self.click_low += self.click_low_coefficient * (noise - self.click_low);
            let mut click = (noise - self.click_low)
                * self.click_envelope
                * params.at(super::CLICK, n)
                * CLICK_LEVEL;
            if self.beater_envelope > SILENCE {
                let hz = BEATER_LOW_HZ + BEATER_SPAN_HZ * self.beater_sweep;
                self.beater_phase = advance_phase(self.beater_phase, (hz / self.sample_rate).min(0.45));
                click += sine(self.beater_phase) * self.beater_envelope;
                self.beater_envelope *= self.beater_coefficient;
                self.beater_sweep *= self.beater_sweep_coefficient;
            }
            if grit > 0.0 {
                // The same high-passed noise, held by the body's envelope: a gritty skin.
                click += grit * (noise - self.click_low) * self.level;
            }
            *sample += trim * saturate(body + click, params.at(super::DRIVE, n), DRIVE_DEPTH);
            self.level *= decay;
            self.pitch_envelope *= self.pitch_coefficient;
            self.click_envelope *= self.click_coefficient;
        }
        self.level > SILENCE || self.click_envelope > SILENCE
    }
}
