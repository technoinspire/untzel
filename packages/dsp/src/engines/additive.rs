// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Additive: up to 16 sine partials with a ratio and level each, three level groups
//! (`low`, `mid`, `high`) the instrument maps onto drawbars, a decaying percussion
//! partial and a short key click. Partials above 0.45 × sample rate are skipped.

use crate::engines::env::{Adsr, AdsrTimes, Decay};
use crate::engines::{limit, played_note};
use crate::math::{Noise, SILENCE, Svf, advance_phase, filter_gain, midi_to_hz, sine};

pub const MAX_PARTIALS: usize = 16;

#[derive(Clone, Copy, Debug)]
pub struct Partial {
    pub ratio: f32,
    /// 0 low, 1 mid, 2 high.
    pub group: usize,
    pub level: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct AdditivePatch {
    pub partials: [Partial; MAX_PARTIALS],
    pub count: usize,
    /// Ratio of the percussion partial (2 or 3).
    pub percussion_ratio: f32,
    pub percussion_decay: f32,
    pub click: f32,
    /// Slow vibrato depth in cents (a rotating speaker, loosely).
    pub vibrato_cents: f32,
    pub level: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct AdditiveControls {
    pub low: f32,
    pub mid: f32,
    pub high: f32,
    pub percussion: f32,
    pub times: AdsrTimes,
}

pub struct AdditiveCore {
    sample_rate: f32,
    patch: AdditivePatch,
    phases: [f32; MAX_PARTIALS],
    percussion_phase: f32,
    percussion: Decay,
    click: Decay,
    click_filter: Svf,
    noise: Noise,
    amp: Adsr,
    note: f32,
    vibrato_phase: f32,
}

impl AdditiveCore {
    pub fn new(sample_rate: f32, patch: AdditivePatch) -> Self {
        AdditiveCore {
            sample_rate,
            patch,
            phases: [0.0; MAX_PARTIALS],
            percussion_phase: 0.0,
            percussion: Decay::default(),
            click: Decay::default(),
            click_filter: Svf::default(),
            noise: Noise::new(0x6f72_6701),
            amp: Adsr::new(sample_rate),
            note: 60.0,
            vibrato_phase: 0.0,
        }
    }

    pub fn trigger(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        controls: &AdditiveControls,
    ) {
        self.note = played_note(note);
        self.amp.trigger(velocity, duration_frames, controls.times);
        self.percussion.trigger(
            controls.percussion,
            self.patch.percussion_decay,
            self.sample_rate,
        );
        self.click
            .trigger(self.patch.click * velocity, 0.004, self.sample_rate);
    }

    pub fn render(&mut self, out: &mut [f32], controls: &AdditiveControls) -> bool {
        if !self.amp.is_active() {
            return false;
        }
        self.amp.set_times(controls.times);
        let patch = self.patch;
        let groups = [controls.low, controls.mid, controls.high];
        let mut levels = [0.0_f32; MAX_PARTIALS];
        let mut increments = [0.0_f32; MAX_PARTIALS];
        let base_hz = midi_to_hz(self.note);
        let nyquist = 0.45 * self.sample_rate;
        let count = patch.count.min(MAX_PARTIALS);
        let mut total = 0.0;
        for index in 0..count {
            let partial = patch.partials[index];
            let hz = base_hz * partial.ratio;
            if hz < nyquist {
                levels[index] = partial.level * groups[partial.group.min(2)];
                increments[index] = hz / self.sample_rate;
                total += levels[index];
            }
        }
        let normalise = patch.level / total.max(1.0);
        let percussion_increment = (base_hz * patch.percussion_ratio / self.sample_rate).min(0.45);
        let vibrato_increment = 5.7 / self.sample_rate;
        let click_g = filter_gain(3_000.0, self.sample_rate);
        for sample in out.iter_mut() {
            self.vibrato_phase = advance_phase(self.vibrato_phase, vibrato_increment);
            let wobble = 1.0 + patch.vibrato_cents * 0.000_577_8 * sine(self.vibrato_phase);
            let mut mix = 0.0;
            for index in 0..count {
                if levels[index] == 0.0 {
                    continue;
                }
                self.phases[index] =
                    advance_phase(self.phases[index], (increments[index] * wobble).min(0.45));
                mix += levels[index] * sine(self.phases[index]);
            }
            mix *= normalise;
            self.percussion_phase = advance_phase(self.percussion_phase, percussion_increment);
            mix += patch.level * 0.6 * self.percussion.tick() * sine(self.percussion_phase);
            let click = self.click.tick();
            if click > SILENCE {
                mix += click
                    * self
                        .click_filter
                        .process(self.noise.sample(), click_g, 1.0)
                        .band;
            }
            *sample += limit(mix * self.amp.tick());
        }
        self.amp.is_active()
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
        *self = AdditiveCore::new(self.sample_rate, patch);
    }
}
