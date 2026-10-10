// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! ADSR amplitude envelope with a gate measured in frames (the note duration). The
//! attack starts from the current level, so a retriggered or stolen voice never clicks.
//!
//! Over 300 lines: with its unit tests; the code alone is under 300.

use crate::math::{SILENCE, decay_coefficient};

/// Fade of a voice taken by the voice limit.
pub const STEAL_SECONDS: f32 = 0.002;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Stage {
    Idle,
    Attack,
    Decay,
    Release,
}

/// Times in seconds and the sustain level 0..1.
#[derive(Clone, Copy, Debug)]
pub struct AdsrTimes {
    pub attack: f32,
    pub decay: f32,
    pub sustain: f32,
    pub release: f32,
}

#[derive(Clone, Copy)]
pub struct Adsr {
    sample_rate: f32,
    stage: Stage,
    level: f32,
    peak: f32,
    attack_step: f32,
    attack_left: u32,
    gate_left: u32,
    decay: f32,
    sustain: f32,
    release: f32,
    stolen: bool,
}

impl Adsr {
    pub fn new(sample_rate: f32) -> Self {
        Adsr {
            sample_rate,
            stage: Stage::Idle,
            level: 0.0,
            peak: 0.0,
            attack_step: 0.0,
            attack_left: 0,
            gate_left: 0,
            decay: 0.0,
            sustain: 0.0,
            release: 0.0,
            stolen: false,
        }
    }

    /// Starts a note of `duration_frames` at `velocity` (the peak).
    pub fn trigger(&mut self, velocity: f32, duration_frames: u32, times: AdsrTimes) {
        self.peak = velocity.clamp(0.0, 1.0);
        self.attack_left = ((times.attack.max(0.0005) * self.sample_rate) as u32).max(1);
        self.attack_step = (self.peak - self.level) / self.attack_left as f32;
        self.gate_left = duration_frames.max(1);
        self.stage = Stage::Attack;
        self.stolen = false;
        self.set_times(times);
    }

    /// Legato: the gate is extended to a new duration, the envelope keeps its level.
    pub fn extend(&mut self, velocity: f32, duration_frames: u32) {
        self.gate_left = duration_frames.max(1);
        if self.stage == Stage::Release || self.stage == Stage::Idle {
            self.stage = Stage::Decay;
        }
        self.peak = velocity.clamp(0.0, 1.0).max(self.peak * 0.5);
    }

    /// Updates the decay, sustain and release from the current parameters (per block).
    pub fn set_times(&mut self, times: AdsrTimes) {
        self.decay = decay_coefficient(times.decay.max(0.001), self.sample_rate);
        self.sustain = times.sustain.clamp(0.0, 1.0);
        let release = if self.stolen {
            STEAL_SECONDS
        } else {
            times.release.max(0.001)
        };
        self.release = decay_coefficient(release, self.sample_rate);
    }

    /// Next envelope value.
    #[inline]
    pub fn tick(&mut self) -> f32 {
        match self.stage {
            Stage::Idle => {}
            Stage::Attack => {
                self.attack_left -= 1;
                self.level += self.attack_step;
                if self.attack_left == 0 {
                    self.level = self.peak;
                    self.stage = Stage::Decay;
                }
            }
            Stage::Decay => {
                let target = self.sustain * self.peak;
                self.level = target + (self.level - target) * self.decay;
            }
            Stage::Release => {
                self.level *= self.release;
                if self.level < SILENCE * 0.1 {
                    self.level = 0.0;
                    self.stage = Stage::Idle;
                }
            }
        }
        if self.stage != Stage::Release && self.stage != Stage::Idle {
            self.gate_left = self.gate_left.saturating_sub(1);
            if self.gate_left == 0 {
                self.stage = Stage::Release;
            }
        }
        self.level
    }

    /// Fades out in 2 ms.
    pub fn steal(&mut self) {
        self.stolen = true;
        self.stage = Stage::Release;
        self.release = decay_coefficient(STEAL_SECONDS, self.sample_rate);
    }

    #[inline]
    pub fn level(&self) -> f32 {
        self.level
    }

    #[inline]
    pub fn is_released(&self) -> bool {
        matches!(self.stage, Stage::Release | Stage::Idle)
    }

    #[inline]
    pub fn is_active(&self) -> bool {
        self.stage != Stage::Idle
    }

    pub fn reset(&mut self) {
        *self = Adsr::new(self.sample_rate);
    }
}

/// One-shot exponential decay (filter and pitch envelopes, percussion layers).
#[derive(Clone, Copy, Default)]
pub struct Decay {
    level: f32,
    coefficient: f32,
}

impl Decay {
    pub fn trigger(&mut self, level: f32, seconds: f32, sample_rate: f32) {
        self.level = level;
        self.coefficient = decay_coefficient(seconds.max(0.0005), sample_rate);
    }

    /// Changes the decay time of a running envelope.
    pub fn set_time(&mut self, seconds: f32, sample_rate: f32) {
        self.coefficient = decay_coefficient(seconds.max(0.0005), sample_rate);
    }

    #[inline]
    pub fn tick(&mut self) -> f32 {
        let value = self.level;
        self.level *= self.coefficient;
        value
    }

    #[inline]
    pub fn level(&self) -> f32 {
        self.level
    }

    pub fn reset(&mut self) {
        self.level = 0.0;
    }
}

/// One-shot envelope that rises linearly to 1 over an attack, then falls as a `Decay`
/// (the filter envelope of a brass "blat" or a slowly opening pad). With no
/// attack it is the `Decay` alone, sample for sample.
#[derive(Clone, Copy, Default)]
pub struct AttackDecay {
    decay: Decay,
    seconds: f32,
    rise: f32,
    rise_step: f32,
    rise_left: u32,
}

impl AttackDecay {
    /// Rises over `attack` seconds (at most 1 ms: no rise), then falls in `seconds`.
    pub fn trigger(&mut self, attack: f32, seconds: f32, sample_rate: f32) {
        self.seconds = seconds;
        if attack <= 0.001 {
            self.rise_left = 0;
            self.decay.trigger(1.0, seconds, sample_rate);
            return;
        }
        // A retrigger rises from where the envelope is, so the filter never jumps.
        let start = if self.rise_left > 0 {
            self.rise
        } else {
            self.decay.level()
        };
        self.rise = start.min(1.0);
        self.rise_left = ((attack * sample_rate) as u32).max(1);
        self.rise_step = (1.0 - self.rise) / self.rise_left as f32;
        self.decay.trigger(0.0, seconds, sample_rate);
    }

    #[inline]
    pub fn tick(&mut self, sample_rate: f32) -> f32 {
        if self.rise_left == 0 {
            return self.decay.tick();
        }
        self.rise_left -= 1;
        self.rise += self.rise_step;
        if self.rise_left == 0 {
            self.decay.trigger(1.0, self.seconds, sample_rate);
            self.rise = 0.0;
            return 1.0;
        }
        self.rise
    }

    pub fn reset(&mut self) {
        *self = AttackDecay::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn without_an_attack_the_rise_is_the_plain_decay() {
        let mut plain = Decay::default();
        let mut shaped = AttackDecay::default();
        plain.trigger(1.0, 0.3, 48_000.0);
        shaped.trigger(0.0005, 0.3, 48_000.0);
        for _ in 0..4_800 {
            assert_eq!(plain.tick().to_bits(), shaped.tick(48_000.0).to_bits());
        }
    }

    #[test]
    fn an_attack_rises_to_one_then_falls() {
        let mut envelope = AttackDecay::default();
        envelope.trigger(0.05, 0.2, 48_000.0);
        let values: Vec<f32> = (0..9_600).map(|_| envelope.tick(48_000.0)).collect();
        assert!(
            values[1_200] > 0.45 && values[1_200] < 0.55,
            "{}",
            values[1_200]
        );
        assert!((values[2_399] - 1.0).abs() < 1e-3);
        assert!(values[9_599] < 0.2);
    }

    const TIMES: AdsrTimes = AdsrTimes {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.5,
        release: 0.05,
    };

    #[test]
    fn attack_reaches_the_peak_then_decays_to_sustain_then_releases() {
        let mut adsr = Adsr::new(48_000.0);
        adsr.trigger(1.0, 24_000, TIMES);
        let mut max = 0.0_f32;
        for _ in 0..480 {
            max = max.max(adsr.tick());
        }
        assert!((max - 1.0).abs() < 1e-3);
        for _ in 0..20_000 {
            adsr.tick();
        }
        assert!((adsr.level() - 0.5).abs() < 0.01);
        assert!(!adsr.is_released());
        for _ in 0..30_000 {
            adsr.tick();
        }
        assert!(adsr.is_released());
        assert!(!adsr.is_active());
    }

    #[test]
    fn a_stolen_envelope_is_silent_within_a_few_milliseconds() {
        let mut adsr = Adsr::new(48_000.0);
        adsr.trigger(1.0, 48_000, TIMES);
        for _ in 0..1000 {
            adsr.tick();
        }
        adsr.steal();
        for _ in 0..(0.02 * 48_000.0) as usize {
            adsr.tick();
        }
        assert!(adsr.level() < 1e-3);
    }
}
