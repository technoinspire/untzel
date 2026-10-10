// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
//! Voice of `djembe`: a goblet drum: membrane modes, a deep bass in the middle and a sharp
//! slap at the edge (`hardness`), with a small pitch bend.
use crate::engines::modal::{Exciter, ModalBank, Mode, hammer_response, slap};
use crate::engines::skin::Skin;
use crate::voice::{Params, Voice};

const RATIOS: [f32; 8] = [1.0, 1.59, 2.14, 2.3, 2.65, 2.92, 3.16, 3.5];
const GAINS: [f32; 8] = [1.0, 0.5, 0.36, 0.26, 0.2, 0.14, 0.1, 0.07];
/// Lowest fundamental (tune 0) and the octaves `tune` spans.
const LOW_HZ: f32 = 65.0;
const TUNE_OCTAVES: f32 = 2.6;
/// The hand contact: centre, length and level at full hardness.
const SKIN_HZ: f32 = 1_900.0;
const SKIN_SECONDS: f32 = 0.03;
const SKIN_LEVEL: f32 = 0.4;
const LEVEL: f32 = 0.41;
/// A slap rings every mode from a hard contact: its peak is far above the struck tone.
const SLAP_LEVEL: f32 = 0.5;

pub struct DjembeVoice {
    sample_rate: f32,
    bank: ModalBank<8>,
    /// Pitch ratio above the resting pitch, falling to 1 (the bend).
    bend: f32,
    bend_coefficient: f32,
    bending: bool,
    /// 1 ÷ the hammer response at the struck fundamental (every sound of the drum
    /// peaks alike, whatever the hand).
    compensation: f32,
    skin: Skin,
}

impl Voice for DjembeVoice {
    fn new(sample_rate: f32) -> Self {
        DjembeVoice { sample_rate, bank: ModalBank::new(sample_rate, 0x646a_656d), bend: 1.0, bend_coefficient: 1.0, bending: false, compensation: 1.0, skin: Skin::new(0x646a_6501) }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, _duration_frames: u32, params: &Params) {
        let base = LOW_HZ * (TUNE_OCTAVES * params.at(super::TUNE, 0)).exp2();
        let decay = params.at(super::DECAY, 0);
        let hardness = params.at(super::HARDNESS, 0);
        let mut modes = [Mode::default(); 8];
        for (k, mode) in modes.iter_mut().enumerate() {
            let gain = GAINS[k] * if k == 0 { 1.0 } else { 0.3 + 1.0 * hardness };
            *mode = Mode { hz: base * RATIOS[k], gain, decay: decay / (1.0 + 0.7 * k as f32) };
        }
        let bend = params.at(super::BEND, 0);
        self.bend = 1.0 + bend;
        self.bend_coefficient = (-1.0 / ((0.02 + 0.25 * decay) * self.sample_rate)).exp();
        self.bending = bend > 0.0;
        let hammer_seconds = 0.0015 + 0.005 * (1.0 - hardness);
        let slap_amount = params.at(super::SLAP, 0);
        if slap_amount > 0.0 {
            // A slap: a hard contact with skin noise, no hammer to compensate.
            let exciter = slap(&mut modes, slap_amount);
            // Between the struck tone's level and the slap's, by how much of a slap it is.
            let struck = 1.0 / hammer_response(base * self.bend, hammer_seconds, 0.25);
            let open = (1.0 - slap_amount) * (1.0 - slap_amount);
            self.compensation = SLAP_LEVEL + (struck - SLAP_LEVEL) * open;
            self.bank.strike(&modes, exciter, velocity, 1.0);
        } else {
            self.compensation = 1.0 / hammer_response(base * self.bend, hammer_seconds, 0.25);
            self.bank.strike(&modes, Exciter::Hammer(hammer_seconds), velocity, 0.3 + 0.7 * hardness);
        }
        if self.bending {
            self.bank.retune(self.bend);
        }
        let contact = SKIN_LEVEL * velocity * (0.35 + 0.65 * hardness);
        self.skin.strike(contact, SKIN_HZ, SKIN_SECONDS, self.sample_rate);
    }

    fn render(&mut self, out: &mut [f32], _params: &Params) -> bool {
        if self.bending {
            self.bend = 1.0 + (self.bend - 1.0) * self.bend_coefficient.powi(out.len() as i32);
            self.bank.retune(self.bend);
            self.bending = self.bend > 1.001;
        }
        let ringing = self.bank.render(out, LEVEL * self.compensation);
        self.skin.render(out) || ringing
    }

    fn steal(&mut self) {
        self.bank.steal();
    }

    fn level(&self) -> f32 {
        self.bank.peak()
    }

    fn is_released(&self) -> bool {
        true
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.bank.reset();
        self.skin.reset();
        self.bending = false;
    }
}
