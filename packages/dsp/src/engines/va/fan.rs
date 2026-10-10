// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The oscillator section of the VA voice: the detune fan of up to seven oscillators,
//! each with a second, crossfaded and optionally hard-synced wave, plus the sub and the
//! noise. Also the fan's geometry: where each oscillator sits in pitch and, for a
//! stereo fan, where it sits between left and right.

use super::controls::{VaControls, VaPatch};
use super::oscillator::{Oscillator, Wave};
use super::wander::Wander;
use crate::engines::semitones;
use crate::math::{Noise, advance_phase, sine};

pub const MAX_OSCILLATORS: usize = 7;

/// `sync` 1 puts the second wave this many times above the first.
const SYNC_RATIO: f32 = 3.0;

/// Fan offsets in -1..1 for `count` oscillators (centre first).
pub fn fan(count: usize, index: usize) -> f32 {
    if count <= 1 {
        return 0.0;
    }
    -1.0 + 2.0 * index as f32 / (count - 1) as f32
}

/// A stereo fan places its oscillators irregularly (no two pairs beat at one rate, so
/// the sum does not pump): offsets added to the even positions of `fan`.
const IRREGULAR: [f32; MAX_OSCILLATORS] = [0.0, 0.13, -0.09, 0.0, 0.07, -0.15, 0.0];

/// Position of fan oscillator `index`, irregular when the fan is stereo.
pub fn position(count: usize, index: usize, stereo: bool) -> f32 {
    let even = fan(count, index);
    if stereo && count > 2 {
        (even + IRREGULAR[index]).clamp(-1.0, 1.0)
    } else {
        even
    }
}

/// Side weight of fan oscillator `index`: alternately left and right, the outer ones
/// widest, scaled by `spread`.
fn pan(count: usize, index: usize, spread: f32) -> f32 {
    let side = if index.is_multiple_of(2) { 1.0 } else { -1.0 };
    spread * side * (0.5 + 0.5 * fan(count, index).abs())
}

/// The side weights of the first `count` oscillators (all zero for a mono fan).
pub fn pans(count: usize, spread: f32, stereo: bool) -> [f32; MAX_OSCILLATORS] {
    let mut pans = [0.0_f32; MAX_OSCILLATORS];
    if stereo {
        for (index, weight) in pans[..count].iter_mut().enumerate() {
            *weight = pan(count, index, spread);
        }
    }
    pans
}

/// What the oscillators of one sample produce, before the filter.
pub struct FanSample {
    pub mid: f32,
    pub side: f32,
}

/// The oscillators of one voice and their analog wander.
pub struct Fan {
    oscillators: [Oscillator; MAX_OSCILLATORS],
    second: [Oscillator; MAX_OSCILLATORS],
    sub: Oscillator,
    noise: Noise,
    /// Start phases of a stereo fan (kept apart from `noise`, so the noise does not move).
    phases: Noise,
    wander: Wander,
    counter_phase: f32,
}

impl Fan {
    pub fn new() -> Self {
        let mut oscillators = [Oscillator::default(); MAX_OSCILLATORS];
        // Spread start phases so the fan does not start as one loud edge.
        for (index, oscillator) in oscillators.iter_mut().enumerate() {
            oscillator.phase = (index as f32 * 0.618_034) % 1.0;
        }
        Fan {
            oscillators,
            second: oscillators,
            sub: Oscillator::default(),
            noise: Noise::new(0x7661_0001),
            phases: Noise::new(0x7661_0002),
            wander: Wander::new(),
            counter_phase: 0.0,
        }
    }

    /// A stereo fan starts each note at a new phase: no two notes beat alike.
    pub fn scatter_phases(&mut self) {
        for (first, second) in self.oscillators.iter_mut().zip(self.second.iter_mut()) {
            first.phase = 0.5 + 0.5 * self.phases.sample();
            second.phase = first.phase;
        }
    }

    /// A new note: each oscillator and the filter draw their card.
    pub fn new_note(&mut self, note: f32) {
        self.wander.new_note(note);
    }

    /// The note's cutoff offset in octaves.
    pub fn cutoff_card_octaves(&self, patch: &VaPatch) -> f32 {
        patch.card_cutoff_octaves * self.wander.cutoff_card()
    }

    /// Per block: the fan ratios with each oscillator's wander and card.
    pub fn ratios(
        &mut self,
        patch: &VaPatch,
        count: usize,
        detune: f32,
        frames: usize,
        stereo: bool,
        sample_rate: f32,
    ) -> [f32; MAX_OSCILLATORS] {
        let spread = detune.clamp(0.0, 1.0) * patch.detune_spread;
        let analog = patch.drift_cents > 0.0 || patch.card_cents > 0.0;
        if analog {
            self.wander.advance(frames as f32 / sample_rate);
        }
        self.counter_phase = advance_phase(self.counter_phase, 0.31 * frames as f32 / sample_rate);
        let counter = patch.counter_drift_cents * sine(self.counter_phase);
        let mut ratios = [1.0_f32; MAX_OSCILLATORS];
        for (index, ratio) in ratios[..count].iter_mut().enumerate() {
            let mut cents = counter * fan(count, count - 1 - index);
            if analog {
                cents += self
                    .wander
                    .cents(index, patch.drift_cents, patch.card_cents);
            }
            *ratio = semitones(position(count, index, stereo) * spread + 0.01 * cents);
        }
        ratios
    }

    /// The fan, the second wave, the sub and the noise of one sample.
    #[inline]
    pub fn sample(
        &mut self,
        patch: &VaPatch,
        base: f32,
        ratios: &[f32],
        pans: &[f32],
        controls: &VaControls,
        stereo: bool,
    ) -> FanSample {
        let shape = controls.shape;
        let gain = patch.level / (ratios.len() as f32).sqrt();
        let (mut mid, mut side) = (0.0, 0.0);
        for (index, &ratio) in ratios.iter().enumerate() {
            let increment = base * ratio;
            let value = if shape.mix > 0.0 {
                let (first, wrapped) =
                    self.oscillators[index].next_wrapping(increment, controls.wave, controls.width);
                let slave = increment * (1.0 + SYNC_RATIO * shape.sync);
                let reset = (shape.sync > 0.0 && wrapped)
                    .then(|| self.oscillators[index].phase / increment.min(0.45));
                let second =
                    self.second[index].next_synced(slave, shape.wave2, controls.width, reset);
                first + shape.mix * (second - first)
            } else {
                self.oscillators[index].next(increment, controls.wave, controls.width)
            };
            mid += value;
            if stereo {
                side += value * pans[index];
            }
        }
        mid *= gain;
        side *= gain;
        let sub = shape.sub.unwrap_or(patch.sub);
        if sub > 0.0 {
            mid += sub * patch.level * self.sub.next(base * 0.5, Wave::Sine, 0.5);
        }
        let noise = shape.noise.unwrap_or(patch.noise);
        if noise > 0.0 {
            mid += noise * patch.level * self.noise.sample();
        }
        FanSample { mid, side }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_fan_is_even_and_centred() {
        assert_eq!(fan(1, 0), 0.0);
        assert_eq!([fan(3, 0), fan(3, 1), fan(3, 2)], [-1.0, 0.0, 1.0]);
        assert_eq!(position(3, 1, false), 0.0);
    }

    #[test]
    fn a_stereo_fan_alternates_sides_and_a_mono_one_has_none() {
        let wide = pans(3, 1.0, true);
        assert!(wide[0] > 0.0 && wide[1] < 0.0 && wide[2] > 0.0);
        assert!(pans(3, 1.0, false).iter().all(|weight| *weight == 0.0));
    }
}
