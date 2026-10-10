// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The slot's reply to the insert-chain and modulator messages (`effect_order`,
//! `effects_commit`, `modulator_set`, `envelope_set`, `modulator_clear`) and the audio
//! thread's `modulate`. Nothing here allocates. Kept apart from the lifecycle and the
//! meter because its reason to change is the message protocol, not voice rendering.

use super::Slot;
use crate::modulation::{Drive, MAX_MODULATORS, UPDATE_FRAMES};
use crate::params::{EFFECT_BASE, EFFECT_COUNT, GAIN, INSTRUMENT_BASE, PAN};

impl Slot {
    /// Writes `kind` at `position` of the pending effect order. False when refused.
    pub fn effect_order(&mut self, position: u32, kind: u32) -> bool {
        self.inserts.chain.stage(position, kind)
    }

    /// The first `count` staged effects become the chain at `at_frame`.
    pub fn effects_commit(&mut self, count: u32, at_frame: f64) -> bool {
        self.inserts.chain.commit(count, at_frame)
    }

    /// Fast signals and envelopes drive instrument and effect parameters, `gain` and
    /// `pan` only.
    fn takes_modulator(&self, param: usize) -> bool {
        let allowed = param == GAIN
            || param == PAN
            || (EFFECT_BASE..EFFECT_BASE + EFFECT_COUNT).contains(&param)
            || param >= INSTRUMENT_BASE;
        allowed && self.params.is_modulatable(param)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn modulator_set(
        &mut self,
        param: u32,
        shape: u32,
        curve: u32,
        period_frames: f64,
        origin_frame: f64,
        low: f32,
        high: f32,
    ) -> bool {
        let param = param as usize;
        if !self.takes_modulator(param) {
            return false;
        }
        let (low, high) = self.clamped(param, low, high);
        let placed =
            self.modulators
                .set_lfo(param, shape, curve, period_frames, origin_frame, low, high);
        if placed {
            self.params.lock(param, true);
        }
        placed
    }

    pub fn envelope_set(
        &mut self,
        param: u32,
        curve: u32,
        seconds: f32,
        from: f32,
        to: f32,
    ) -> bool {
        let param = param as usize;
        if !self.takes_modulator(param) {
            return false;
        }
        let (from, to) = self.clamped(param, from, to);
        let placed = self
            .modulators
            .set_envelope(param, curve, seconds, from, to);
        if placed {
            self.params.lock(param, true);
        }
        placed
    }

    /// The index obeys `param_set`/`param_push` again, from its current value.
    pub fn modulator_clear(&mut self, param: u32) -> bool {
        let param = param as usize;
        let cleared = self.modulators.clear(param);
        if cleared {
            self.params.lock(param, false);
        }
        cleared
    }

    fn clamped(&self, param: usize, low: f32, high: f32) -> (f32, f32) {
        let (min, max) = self.params.range(param);
        if low.is_finite() && high.is_finite() {
            (low.clamp(min, max), high.clamp(min, max))
        } else {
            (low, high)
        }
    }

    /// Audio thread: ramps every modulated parameter to its next value when due.
    pub fn modulate(&mut self, frame: f64) {
        if self.modulators.is_empty() {
            return;
        }
        let mut drives = [Drive::NONE; MAX_MODULATORS];
        let count = self.modulators.due(frame, self.sample_rate, &mut drives);
        for drive in &drives[..count] {
            if let Some(from) = drive.from {
                self.params.drive(drive.param, from, 0);
            }
            self.params.drive(drive.param, drive.value, UPDATE_FRAMES);
        }
    }
}
