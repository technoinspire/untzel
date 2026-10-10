// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Formant voice: up to three detuned band-limited sources (a glottal-like saw) plus
//! breath noise, through five parallel band-passes tuned to a vowel. `vowel` 0..1 moves
//! continuously through a, e, i, o, u. The vowel table is a rounded set of typical
//! formant frequencies of sung vowels, written for Untzel.

use crate::engines::env::{Adsr, AdsrTimes};
use crate::engines::{Glide, fast_semitones, limit, played_note};
use crate::math::{Noise, SILENCE, Svf, advance_phase, filter_gain, midi_to_hz, poly_blep, sine};

pub const FORMANTS: usize = 5;
pub const MAX_SOURCES: usize = 3;

/// Formant frequency (Hz), bandwidth (Hz) and gain of each vowel a, e, i, o, u.
const VOWELS: [[(f32, f32, f32); FORMANTS]; 5] = [
    [
        (780.0, 80.0, 1.0),
        (1_180.0, 90.0, 0.5),
        (2_850.0, 120.0, 0.08),
        (3_700.0, 130.0, 0.1),
        (4_900.0, 140.0, 0.01),
    ],
    [
        (400.0, 70.0, 1.0),
        (1_950.0, 80.0, 0.2),
        (2_750.0, 100.0, 0.25),
        (3_550.0, 120.0, 0.05),
        (4_900.0, 120.0, 0.02),
    ],
    [
        (290.0, 60.0, 1.0),
        (2_150.0, 90.0, 0.25),
        (2_950.0, 100.0, 0.08),
        (3_850.0, 120.0, 0.06),
        (4_900.0, 120.0, 0.01),
    ],
    [
        (460.0, 70.0, 1.0),
        (820.0, 80.0, 0.3),
        (2_800.0, 100.0, 0.08),
        (3_750.0, 130.0, 0.08),
        (4_900.0, 135.0, 0.01),
    ],
    [
        (330.0, 50.0, 1.0),
        (720.0, 60.0, 0.18),
        (2_680.0, 170.0, 0.02),
        (3_750.0, 180.0, 0.01),
        (4_900.0, 200.0, 0.002),
    ],
];

#[derive(Clone, Copy, Debug)]
pub struct FormantPatch {
    pub sources: usize,
    /// Widest detune between sources at `detune` 1, semitones.
    pub detune_spread: f32,
    /// Vibrato depth in semitones and rate in Hz.
    pub vibrato: f32,
    pub vibrato_hz: f32,
    pub level: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct FormantControls {
    pub vowel: f32,
    pub breath: f32,
    pub brightness: f32,
    pub detune: f32,
    pub times: AdsrTimes,
}

/// Formants of a vowel position 0..1 (a .. u), linearly interpolated.
fn vowel_at(position: f32) -> [(f32, f32, f32); FORMANTS] {
    let x = position.clamp(0.0, 1.0) * (VOWELS.len() - 1) as f32;
    let index = (x.floor() as usize).min(VOWELS.len() - 2);
    let t = x - index as f32;
    let mut out = VOWELS[index];
    for (slot, (a, b)) in out
        .iter_mut()
        .zip(VOWELS[index].iter().zip(&VOWELS[index + 1]))
    {
        *slot = (
            a.0 + t * (b.0 - a.0),
            a.1 + t * (b.1 - a.1),
            a.2 + t * (b.2 - a.2),
        );
    }
    out
}

pub struct FormantCore {
    sample_rate: f32,
    patch: FormantPatch,
    phases: [f32; MAX_SOURCES],
    filters: [Svf; FORMANTS],
    noise: Noise,
    amp: Adsr,
    glide: Glide,
    vibrato_phase: f32,
    vibrato_onset: f32,
}

impl FormantCore {
    pub fn new(sample_rate: f32, patch: FormantPatch) -> Self {
        let mut phases = [0.0; MAX_SOURCES];
        for (index, phase) in phases.iter_mut().enumerate() {
            *phase = index as f32 * 0.37;
        }
        FormantCore {
            sample_rate,
            patch,
            phases,
            filters: [Svf::default(); FORMANTS],
            noise: Noise::new(0x766f_7801),
            amp: Adsr::new(sample_rate),
            glide: Glide::default(),
            vibrato_phase: 0.0,
            vibrato_onset: 0.0,
        }
    }

    pub fn trigger(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        controls: &FormantControls,
    ) {
        self.glide.set(played_note(note));
        self.amp.trigger(velocity, duration_frames, controls.times);
        self.vibrato_onset = 0.0;
    }

    pub fn legato(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        glide_frames: u32,
        retrigger: bool,
        controls: &FormantControls,
    ) {
        self.glide.glide_to(played_note(note), glide_frames);
        if retrigger {
            self.amp.trigger(velocity, duration_frames, controls.times);
        } else {
            self.amp.extend(velocity, duration_frames);
        }
    }

    pub fn render(&mut self, out: &mut [f32], controls: &FormantControls) -> bool {
        if !self.amp.is_active() {
            return false;
        }
        self.amp.set_times(controls.times);
        let patch = self.patch;
        let sources = patch.sources.clamp(1, MAX_SOURCES);
        let formants = vowel_at(controls.vowel);
        let brightness = controls.brightness.clamp(0.0, 1.0);
        let mut gains = [0.0_f32; FORMANTS];
        let mut coefficients = [(0.0_f32, 0.0_f32); FORMANTS];
        for (index, &(hz, bandwidth, gain)) in formants.iter().enumerate() {
            let tilt = if index == 0 {
                1.0
            } else {
                0.4 + 1.2 * brightness
            };
            gains[index] = gain * tilt;
            coefficients[index] = (
                filter_gain(hz, self.sample_rate),
                (bandwidth / hz).max(0.02),
            );
        }
        let spread = controls.detune.clamp(0.0, 1.0) * patch.detune_spread;
        let mut ratios = [1.0_f32; MAX_SOURCES];
        for (index, ratio) in ratios[..sources].iter_mut().enumerate() {
            let offset = if sources == 1 {
                0.0
            } else {
                -1.0 + 2.0 * index as f32 / (sources - 1) as f32
            };
            *ratio = crate::engines::semitones(offset * spread);
        }
        let breath = controls.breath.clamp(0.0, 1.0);
        let vibrato_increment = patch.vibrato_hz / self.sample_rate;
        let onset_step = 1.0 / (0.4 * self.sample_rate);
        let mut base = midi_to_hz(self.glide.note()) / self.sample_rate;
        for sample in out.iter_mut() {
            let note = self.glide.tick();
            self.vibrato_phase = advance_phase(self.vibrato_phase, vibrato_increment);
            self.vibrato_onset = (self.vibrato_onset + onset_step).min(1.0);
            let vibrato = patch.vibrato * self.vibrato_onset * sine(self.vibrato_phase);
            if self.glide.is_gliding() || patch.vibrato > 0.0 {
                base = 440.0 * fast_semitones(note - 69.0 + vibrato) / self.sample_rate;
            }
            let mut source = 0.0;
            for (phase, &ratio) in self.phases[..sources].iter_mut().zip(&ratios[..sources]) {
                let dt = (base * ratio).min(0.45);
                *phase = advance_phase(*phase, dt);
                source += 2.0 * *phase - 1.0 - poly_blep(*phase, dt);
            }
            source =
                source / sources as f32 * (1.0 - 0.6 * breath) + breath * 0.8 * self.noise.sample();
            let mut mix = 0.0;
            for ((filter, &(g, k)), &gain) in self.filters.iter_mut().zip(&coefficients).zip(&gains)
            {
                mix += gain * filter.process(source, g, k).band;
            }
            *sample += limit(mix * patch.level * self.amp.tick());
        }
        self.amp.is_active() || self.amp.level() > SILENCE
    }

    pub fn steal(&mut self) {
        self.amp.steal();
    }

    pub fn level(&self) -> f32 {
        self.amp.level()
    }

    pub fn is_released(&self) -> bool {
        self.amp.is_released()
    }

    pub fn reset(&mut self) {
        let patch = self.patch;
        *self = FormantCore::new(self.sample_rate, patch);
    }
}
