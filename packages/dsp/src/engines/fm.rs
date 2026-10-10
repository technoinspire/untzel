// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! FM: four sine operators in one of eight fixed algorithms, feedback on operator 4,
//! a frequency ratio, level and decay per operator. The carriers follow the ADSR; the
//! modulators decay on their own, which is what makes tines, bells and plucked basses.

use crate::engines::env::{Adsr, AdsrTimes, Decay};
use crate::engines::{Glide, limit, played_note};
use crate::math::{SILENCE, sine};

pub const OPERATORS: usize = 4;

/// Which operators modulate each operator (bit i = operator i), and which are
/// carriers. Operators are computed from 4 down to 1, so a modulator always has a
/// higher index than what it modulates.
#[derive(Clone, Copy, Debug)]
pub struct Algorithm {
    pub modulators: [u8; OPERATORS],
    pub carriers: u8,
}

/// The eight algorithms. Index 0 is operator 1.
pub const ALGORITHMS: [Algorithm; 8] = [
    // 0: 4 → 3 → 2 → 1
    Algorithm {
        modulators: [0b0010, 0b0100, 0b1000, 0],
        carriers: 0b0001,
    },
    // 1: (4 → 3) + (2 → 1): two stacks
    Algorithm {
        modulators: [0b0010, 0, 0b1000, 0],
        carriers: 0b0101,
    },
    // 2: (3 + 4) → 2 → 1
    Algorithm {
        modulators: [0b0010, 0b1100, 0, 0],
        carriers: 0b0001,
    },
    // 3: 4 → (1, 2, 3)
    Algorithm {
        modulators: [0b1000, 0b1000, 0b1000, 0],
        carriers: 0b0111,
    },
    // 4: (2 + 3 + 4) → 1
    Algorithm {
        modulators: [0b1110, 0, 0, 0],
        carriers: 0b0001,
    },
    // 5: 4 → 3 → 1, 2 → 1
    Algorithm {
        modulators: [0b0110, 0, 0b1000, 0],
        carriers: 0b0001,
    },
    // 6: 4 → 3, 1, 2 carriers
    Algorithm {
        modulators: [0, 0, 0b1000, 0],
        carriers: 0b0111,
    },
    // 7: four carriers (additive)
    Algorithm {
        modulators: [0, 0, 0, 0],
        carriers: 0b1111,
    },
];

#[derive(Clone, Copy, Debug)]
pub struct Operator {
    /// Frequency ratio to the note.
    pub ratio: f32,
    /// Fixed offset in Hz (inharmonic bells).
    pub offset_hz: f32,
    /// Output level: for a modulator, the modulation index at `brightness` 1.
    pub level: f32,
    /// Decay of a modulator as a fraction of the `decay` parameter (carriers use the
    /// ADSR).
    pub decay: f32,
    /// Level a modulator keeps after its decay, 0..1.
    pub sustain: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct FmPatch {
    pub algorithm: usize,
    pub operators: [Operator; OPERATORS],
    /// Feedback of operator 4 at `feedback` 1.
    pub feedback_depth: f32,
    /// Velocity raises the modulation index by this fraction.
    pub velocity_brightness: f32,
    pub level: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct FmControls {
    pub brightness: f32,
    pub feedback: f32,
    pub detune: f32,
    pub times: AdsrTimes,
    /// Multiplies each operator's level; 1 keeps it.
    pub operator_levels: [f32; OPERATORS],
}

/// Every operator at its patch level.
pub const PATCH_LEVELS: [f32; OPERATORS] = [1.0; OPERATORS];

pub struct FmCore {
    sample_rate: f32,
    patch: FmPatch,
    phases: [f32; OPERATORS],
    envelopes: [Decay; OPERATORS],
    amp: Adsr,
    glide: Glide,
    feedback: [f32; 2],
    velocity: f32,
}

#[inline]
fn wrap(phase: f32) -> f32 {
    phase - phase.floor()
}

impl FmCore {
    pub fn new(sample_rate: f32, patch: FmPatch) -> Self {
        FmCore {
            sample_rate,
            patch,
            phases: [0.0; OPERATORS],
            envelopes: [Decay::default(); OPERATORS],
            amp: Adsr::new(sample_rate),
            glide: Glide::default(),
            feedback: [0.0; 2],
            velocity: 0.0,
        }
    }

    pub fn trigger(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        controls: &FmControls,
    ) {
        self.glide.set(played_note(note));
        self.start(velocity, duration_frames, controls);
    }

    pub fn legato(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        glide_frames: u32,
        retrigger: bool,
        controls: &FmControls,
    ) {
        self.glide.glide_to(played_note(note), glide_frames);
        if retrigger {
            self.start(velocity, duration_frames, controls);
        } else {
            self.amp.extend(velocity, duration_frames);
        }
    }

    fn start(&mut self, velocity: f32, duration_frames: u32, controls: &FmControls) {
        self.velocity = velocity;
        self.amp.trigger(velocity, duration_frames, controls.times);
        for (envelope, operator) in self.envelopes.iter_mut().zip(&self.patch.operators) {
            let seconds = (controls.times.decay * operator.decay).max(0.002);
            envelope.trigger(1.0 - operator.sustain, seconds, self.sample_rate);
        }
        if !self.amp.is_active() {
            self.phases = [0.0; OPERATORS];
        }
    }

    pub fn render(&mut self, out: &mut [f32], controls: &FmControls) -> bool {
        if !self.amp.is_active() {
            return false;
        }
        self.amp.set_times(controls.times);
        let patch = self.patch;
        let algorithm = ALGORITHMS[patch.algorithm.min(ALGORITHMS.len() - 1)];
        let index_scale = controls.brightness.clamp(0.0, 1.0)
            * (1.0 + patch.velocity_brightness * (self.velocity - 0.8));
        let feedback = controls.feedback.clamp(0.0, 1.0) * patch.feedback_depth;
        let detune = 1.0 + 0.003 * controls.detune;
        let carriers = algorithm.carriers.count_ones().max(1) as f32;
        let mut increments = [0.0_f32; OPERATORS];
        let nyquist = 0.45 * self.sample_rate;
        let levels = controls.operator_levels;
        for sample in out.iter_mut() {
            if self.glide.is_gliding() || increments[0] == 0.0 {
                let note = self.glide.tick();
                let base = 440.0 * crate::engines::fast_semitones(note - 69.0);
                for (index, operator) in patch.operators.iter().enumerate() {
                    let hz = base * operator.ratio * if index == 2 { detune } else { 1.0 }
                        + operator.offset_hz;
                    increments[index] = if hz < nyquist {
                        hz / self.sample_rate
                    } else {
                        0.0
                    };
                }
            }
            let mut outputs = [0.0_f32; OPERATORS];
            let mut carrier_sum = 0.0;
            for index in (0..OPERATORS).rev() {
                let operator = patch.operators[index];
                let level = operator.level * levels[index];
                let mut modulation = 0.0;
                let mask = algorithm.modulators[index];
                for (source, output) in outputs.iter().enumerate().skip(index + 1) {
                    if mask & (1 << source) != 0 {
                        modulation += output;
                    }
                }
                if index == OPERATORS - 1 {
                    modulation += feedback * 0.5 * (self.feedback[0] + self.feedback[1]);
                }
                self.phases[index] = wrap(self.phases[index] + increments[index]);
                let value = sine(wrap(self.phases[index] + modulation));
                let is_carrier = algorithm.carriers & (1 << index) != 0;
                let envelope = operator.sustain + self.envelopes[index].tick();
                if is_carrier {
                    carrier_sum += value * level;
                    outputs[index] = value * envelope * level;
                } else {
                    outputs[index] = value * envelope * level * index_scale;
                }
                if index == OPERATORS - 1 {
                    self.feedback[1] = self.feedback[0];
                    self.feedback[0] = outputs[index];
                }
            }
            let level = self.amp.tick();
            *sample += limit(carrier_sum / carriers * level * patch.level);
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
        *self = FmCore::new(self.sample_rate, patch);
    }
}
