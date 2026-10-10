// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Analog wander of the VA oscillators. In an analog polysynth no oscillator
//! holds its pitch: each one drifts slowly on its own, and each voice card is tuned a
//! little differently, so two notes never sound alike and a chord breathes. Here every
//! oscillator glides toward a random target it holds for a random while (a smoothed
//! random walk, about 0.2 to 1 Hz), and every new note draws a static offset per
//! oscillator and one for the filter (the card). Deterministic: the generator starts from
//! one seed and folds in each note it plays.

use super::fan::MAX_OSCILLATORS;
use crate::math::Noise;

/// How long an oscillator holds a target before it picks the next: 0.5× to 1.5× of this.
const HOLD_SECONDS: f32 = 0.9;
/// Time constant of the glide toward the target.
const GLIDE_SECONDS: f32 = 0.5;
const SEED: u32 = 0x616e_616c;

#[derive(Clone, Copy)]
pub struct Wander {
    random: Noise,
    /// Smoothed walk of each oscillator, −1..1.
    value: [f32; MAX_OSCILLATORS],
    target: [f32; MAX_OSCILLATORS],
    /// Seconds until each oscillator picks a new target.
    left: [f32; MAX_OSCILLATORS],
    /// The note's static offset of each oscillator, −1..1.
    card: [f32; MAX_OSCILLATORS],
    /// The note's static offset of the filter, −1..1.
    cutoff_card: f32,
}

impl Wander {
    pub fn new() -> Self {
        let mut wander = Wander {
            random: Noise::new(SEED),
            value: [0.0; MAX_OSCILLATORS],
            target: [0.0; MAX_OSCILLATORS],
            left: [0.0; MAX_OSCILLATORS],
            card: [0.0; MAX_OSCILLATORS],
            cutoff_card: 0.0,
        };
        for index in 0..MAX_OSCILLATORS {
            wander.value[index] = wander.random.sample();
            wander.target[index] = wander.random.sample();
            wander.left[index] = wander.hold();
        }
        wander
    }

    fn hold(&mut self) -> f32 {
        HOLD_SECONDS * (1.0 + 0.5 * self.random.sample())
    }

    /// A new note: folds the note into the generator and draws the card.
    pub fn new_note(&mut self, note: f32) {
        self.random.mix(note.to_bits());
        for card in &mut self.card {
            *card = self.random.sample();
        }
        self.cutoff_card = self.random.sample();
    }

    /// Moves every oscillator's walk by one block of `seconds`.
    pub fn advance(&mut self, seconds: f32) {
        let step = (seconds / GLIDE_SECONDS).min(1.0);
        for index in 0..MAX_OSCILLATORS {
            self.left[index] -= seconds;
            if self.left[index] <= 0.0 {
                self.target[index] = self.random.sample();
                self.left[index] = self.hold();
            }
            self.value[index] += step * (self.target[index] - self.value[index]);
        }
    }

    /// Pitch offset of oscillator `index` in cents: the walk times `drift_cents` plus the
    /// card times `card_cents`.
    #[inline]
    pub fn cents(&self, index: usize, drift_cents: f32, card_cents: f32) -> f32 {
        self.value[index] * drift_cents + self.card[index] * card_cents
    }

    /// The note's filter offset, −1..1.
    pub fn cutoff_card(&self) -> f32 {
        self.cutoff_card
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_notes_draw_different_cards_and_the_walk_stays_in_range() {
        let mut wander = Wander::new();
        wander.new_note(60.0);
        let first = (wander.cents(0, 0.0, 1.0), wander.cutoff_card());
        wander.new_note(60.0);
        assert_ne!(first, (wander.cents(0, 0.0, 1.0), wander.cutoff_card()));
        for _ in 0..10_000 {
            wander.advance(128.0 / 48_000.0);
            for index in 0..MAX_OSCILLATORS {
                assert!(wander.cents(index, 1.0, 0.0).abs() <= 1.0);
            }
        }
    }

    #[test]
    fn the_same_notes_in_the_same_order_wander_alike() {
        let (mut a, mut b) = (Wander::new(), Wander::new());
        for note in [57.0, 60.0, 64.0] {
            a.new_note(note);
            b.new_note(note);
            a.advance(0.1);
            b.advance(0.1);
        }
        assert_eq!(a.cents(3, 4.0, 2.0), b.cents(3, 4.0, 2.0));
    }
}
