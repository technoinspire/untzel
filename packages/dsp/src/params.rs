// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Smoothed parameters of one slot. Every value moves by linear ramps in parameter
//! units; the engine splits the block at ramp starts and ends, so inside a sub-block a
//! value is exactly `start + step × n`.
//!
//! Layout of a bank (DSP parameter indices of `ABI.md`):
//! - `0..10` general (`gain`, `pan`, `reverbSend`, `reverbSpace`, `delaySend`,
//!   `delayDivision`, `duck`, `glide`, `legato`, `audible`), `10..16` reserved;
//! - `16..32` the insert effects (`EFFECT_PARAMETERS`);
//! - `32..32 + count` the instrument parameters in manifest order;
//! - after the largest instrument, six internal bus weights (three reverb spaces, three
//!   delay divisions), each 1 on the chosen bus and 0 on the others, ramped in 20 ms so
//!   that switching bus never clicks.
//!
//! Over 300 lines: its unit tests included; one bank layout of ABI.md and its ramps, which live together.

use crate::instruments::MAX_PARAMETER_COUNT;
use crate::voice::Params;

pub const GAIN: usize = 0;
pub const PAN: usize = 1;
pub const REVERB_SEND: usize = 2;
pub const REVERB_SPACE: usize = 3;
pub const DELAY_SEND: usize = 4;
pub const DELAY_DIVISION: usize = 5;
pub const DUCK: usize = 6;
/// Portamento of a mono instrument, seconds.
pub const GLIDE: usize = 7;
/// 1 = legato (mono instruments keep their envelopes running).
pub const LEGATO: usize = 8;
/// 1 sounds, 0 is silent (solo). Applied after `gain`; never a modulation target.
pub const AUDIBLE: usize = 9;
const GENERAL_COUNT: usize = 10;
pub const EFFECT_BASE: usize = 16;
pub const EFFECT_COUNT: usize = 16;
pub const INSTRUMENT_BASE: usize = 32;

/// Insert effect parameters, DSP index `EFFECT_BASE + position`: `(min, max, default)`.
/// Order: lowpass, lowpass-q, highpass, highpass-q, distort, crush, chorus,
/// chorus-rate, phaser, phaser-rate, eq-low, eq-mid, eq-mid-freq, eq-high, comp, gate.
pub const EFFECT_PARAMETERS: [(f32, f32, f32); EFFECT_COUNT] = [
    (20.0, 20_000.0, 20_000.0),
    (0.0, 1.0, 0.2),
    (20.0, 20_000.0, 20.0),
    (0.0, 1.0, 0.2),
    (0.0, 1.0, 0.0),
    (0.0, 1.0, 0.0),
    (0.0, 1.0, 0.0),
    (0.05, 5.0, 0.6),
    (0.0, 1.0, 0.0),
    (0.05, 5.0, 0.4),
    (-18.0, 18.0, 0.0),
    (-18.0, 18.0, 0.0),
    (200.0, 8_000.0, 1_000.0),
    (-18.0, 18.0, 0.0),
    (0.0, 1.0, 0.0),
    (0.0, 1.0, 0.0),
];

/// Reverb spaces (`small`, `wide`, `sea`, and the rooms `room`, `plate`,
/// `hall` and `dub`).
pub const REVERB_SPACES: usize = 7;
/// Delay divisions (`1/8`, `3/16`, `1/4`).
pub const DELAY_DIVISIONS: usize = 3;
const REVERB_WEIGHT_BASE: usize = INSTRUMENT_BASE + MAX_PARAMETER_COUNT;
const DELAY_WEIGHT_BASE: usize = REVERB_WEIGHT_BASE + REVERB_SPACES;
const SIZE: usize = DELAY_WEIGHT_BASE + DELAY_DIVISIONS;

/// `(min, max, default)` of the general parameters 0..10.
const GENERAL: [(f32, f32, f32); GENERAL_COUNT] = [
    // gain: the text writes 0..2, the +6 dB fader; above is the tone level
    // correction, up to +12 dB.
    (0.0, 4.0, 1.0),
    (-1.0, 1.0, 0.0),
    (0.0, 1.0, 0.0),
    (0.0, 6.0, 1.0),
    (0.0, 1.0, 0.0),
    (0.0, 2.0, 0.0),
    (0.0, 1.0, 0.0),
    (0.0, 2.0, 0.0),
    (0.0, 1.0, 0.0),
    (0.0, 1.0, 1.0),
];

/// Manifest ranges of one instrument, by local parameter index.
pub struct ParameterRanges {
    pub min: &'static [f32],
    pub max: &'static [f32],
    pub default: &'static [f32],
    /// Choice parameters (`wave`) jump, never ramp: a change from saw to sine never
    /// passes through square and triangle.
    pub is_choice: &'static [bool],
}

/// Value and per-sample ramp of one parameter, as seen by a sub-block.
#[derive(Clone, Copy)]
pub struct Ramped {
    pub start: f32,
    pub step: f32,
}

impl Ramped {
    #[inline]
    pub fn at(self, n: usize) -> f32 {
        self.start + self.step * n as f32
    }

    #[inline]
    pub fn end(self, len: usize) -> f32 {
        self.at(len)
    }

    /// Whether the value is zero over the whole sub-block of `len` samples.
    #[inline]
    pub fn is_silent(self, len: usize) -> bool {
        self.start == 0.0 && self.end(len) == 0.0
    }
}

/// `gain × audible`: the level a slot leaves with, read by the mix, the sidechain and
/// the meters. With `audible` at 1 it is `gain` to the bit.
#[derive(Clone, Copy)]
pub struct OutputGain {
    gain: Ramped,
    audible: Ramped,
}

impl OutputGain {
    #[inline]
    pub fn at(self, n: usize) -> f32 {
        self.gain.at(n) * self.audible.at(n)
    }

    /// Mute and solo alone, without the track's `gain`: what the duck listens to.
    #[inline]
    pub fn audible_at(self, n: usize) -> f32 {
        self.audible.at(n)
    }

    /// Upper bound over a sub-block of `len` samples (both ramps are linear and ≥ 0).
    pub fn bound(self, len: usize) -> f32 {
        self.gain.start.max(self.gain.end(len)) * self.audible.start.max(self.audible.end(len))
    }
}

pub struct ParamBank {
    value: [f32; SIZE],
    step: [f32; SIZE],
    target: [f32; SIZE],
    remaining: [u32; SIZE],
    min: [f32; SIZE],
    max: [f32; SIZE],
    /// Choice parameters: every write lands at once.
    jumps: [bool; SIZE],
    /// Driven by a fast modulator (`modulation.rs`): outside writes are ignored.
    locked: [bool; SIZE],
    instrument_count: usize,
    bus_ramp_frames: u32,
    reverb_space: usize,
    delay_division: usize,
}

impl ParamBank {
    /// Bank at the defaults of the general parameters and of `ranges`.
    pub fn new(ranges: &ParameterRanges, bus_ramp_frames: u32) -> Self {
        let mut bank = ParamBank {
            value: [0.0; SIZE],
            step: [0.0; SIZE],
            target: [0.0; SIZE],
            remaining: [0; SIZE],
            min: [0.0; SIZE],
            max: [0.0; SIZE],
            jumps: [false; SIZE],
            locked: [false; SIZE],
            instrument_count: ranges.default.len().min(MAX_PARAMETER_COUNT),
            bus_ramp_frames,
            reverb_space: 1,
            delay_division: 0,
        };
        for (index, &(min, max, default)) in GENERAL.iter().enumerate() {
            bank.define(index, min, max, default);
        }
        for (position, &(min, max, default)) in EFFECT_PARAMETERS.iter().enumerate() {
            bank.define(EFFECT_BASE + position, min, max, default);
        }
        for local in 0..bank.instrument_count {
            bank.define(
                INSTRUMENT_BASE + local,
                ranges.min[local],
                ranges.max[local],
                ranges.default[local],
            );
            bank.jumps[INSTRUMENT_BASE + local] =
                ranges.is_choice.get(local).copied().unwrap_or(false);
        }
        for index in REVERB_WEIGHT_BASE..SIZE {
            bank.define(index, 0.0, 1.0, 0.0);
        }
        bank.select_buses(true);
        bank
    }

    /// Sets `param` to `value` with no ramp. Unknown or reserved indices are ignored.
    pub fn set(&mut self, param: usize, value: f32) {
        self.ramp_to(param, value, 0);
    }

    /// Ramps `param` from its current value to `value` in `frames` samples. Ignored
    /// while a fast modulator drives the index.
    pub fn ramp_to(&mut self, param: usize, value: f32, frames: u32) {
        if !self.is_writable(param) || !value.is_finite() || self.locked[param] {
            return;
        }
        self.write(param, value, frames);
    }

    /// The modulator's own write: bypasses the lock.
    pub fn drive(&mut self, param: usize, value: f32, frames: u32) {
        if self.is_writable(param) && value.is_finite() {
            self.write(param, value, frames);
        }
    }

    /// Whether `param` is a valid index that a modulator may drive.
    pub fn is_modulatable(&self, param: usize) -> bool {
        self.is_writable(param)
            && !self.jumps[param]
            && param != REVERB_SPACE
            && param != DELAY_DIVISION
            && param != LEGATO
    }

    pub fn lock(&mut self, param: usize, locked: bool) {
        if param < SIZE {
            self.locked[param] = locked;
        }
    }

    pub fn range(&self, param: usize) -> (f32, f32) {
        (self.min[param], self.max[param])
    }

    fn write(&mut self, param: usize, value: f32, frames: u32) {
        let value = value.clamp(self.min[param], self.max[param]);
        let frames = if self.jumps[param] { 0 } else { frames };
        self.start_ramp(param, value, frames);
        if param == REVERB_SPACE || param == DELAY_DIVISION {
            self.select_buses(frames == 0);
        }
    }

    #[inline]
    pub fn get(&self, param: usize) -> Ramped {
        Ramped {
            start: self.value[param],
            step: self.step[param],
        }
    }

    #[inline]
    pub fn output_gain(&self) -> OutputGain {
        OutputGain {
            gain: self.get(GAIN),
            audible: self.get(AUDIBLE),
        }
    }

    pub fn reverb_weight(&self, bus: usize) -> Ramped {
        self.get(REVERB_WEIGHT_BASE + bus)
    }

    pub fn delay_weight(&self, bus: usize) -> Ramped {
        self.get(DELAY_WEIGHT_BASE + bus)
    }

    /// The instrument parameters in the shape the voices read.
    pub fn voice_params(&self) -> Params<'_> {
        let range = INSTRUMENT_BASE..INSTRUMENT_BASE + self.instrument_count;
        Params {
            start: &self.value[range.clone()],
            step: &self.step[range],
        }
    }

    /// Samples until the nearest ramp ends, or None when nothing is moving.
    pub fn frames_to_next_ramp_end(&self) -> Option<u32> {
        self.remaining.iter().copied().filter(|&r| r > 0).min()
    }

    /// Moves every ramp `frames` samples on. The caller never crosses a ramp end.
    pub fn advance(&mut self, frames: u32) {
        for index in 0..SIZE {
            let remaining = self.remaining[index];
            if remaining == 0 {
                continue;
            }
            let frames = frames.min(remaining);
            if frames == remaining {
                self.finish_ramp(index);
            } else {
                self.value[index] += self.step[index] * frames as f32;
                self.remaining[index] = remaining - frames;
            }
        }
    }

    /// Every ramp jumps to its target (used when the engine stops).
    pub fn settle(&mut self) {
        for index in 0..SIZE {
            self.finish_ramp(index);
        }
    }

    fn is_writable(&self, param: usize) -> bool {
        param < GENERAL_COUNT
            || (EFFECT_BASE..EFFECT_BASE + EFFECT_COUNT).contains(&param)
            || (INSTRUMENT_BASE..INSTRUMENT_BASE + self.instrument_count).contains(&param)
    }

    fn define(&mut self, index: usize, min: f32, max: f32, default: f32) {
        self.min[index] = min;
        self.max[index] = max;
        self.value[index] = default;
        self.target[index] = default;
    }

    fn start_ramp(&mut self, index: usize, value: f32, frames: u32) {
        self.target[index] = value;
        if frames == 0 {
            self.finish_ramp(index);
        } else {
            self.step[index] = (value - self.value[index]) / frames as f32;
            self.remaining[index] = frames;
        }
    }

    fn finish_ramp(&mut self, index: usize) {
        self.value[index] = self.target[index];
        self.step[index] = 0.0;
        self.remaining[index] = 0;
    }

    /// Points the bus weights at the space and division currently written.
    fn select_buses(&mut self, immediate: bool) {
        self.reverb_space = choice(self.target[REVERB_SPACE], REVERB_SPACES);
        self.delay_division = choice(self.target[DELAY_DIVISION], DELAY_DIVISIONS);
        let frames = if immediate { 0 } else { self.bus_ramp_frames };
        for bus in 0..REVERB_SPACES {
            let reverb = f32::from(u8::from(bus == self.reverb_space));
            if self.target[REVERB_WEIGHT_BASE + bus] != reverb {
                self.start_ramp(REVERB_WEIGHT_BASE + bus, reverb, frames);
            }
        }
        for bus in 0..DELAY_DIVISIONS {
            let delay = f32::from(u8::from(bus == self.delay_division));
            if self.target[DELAY_WEIGHT_BASE + bus] != delay {
                self.start_ramp(DELAY_WEIGHT_BASE + bus, delay, frames);
            }
        }
    }
}

/// Discrete bus index of a `reverbSpace` or `delayDivision` value.
fn choice(value: f32, count: usize) -> usize {
    (value.round() as usize).min(count - 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    static RANGES: ParameterRanges = ParameterRanges {
        min: &[40.0, 0.0],
        max: &[8000.0, 3.0],
        default: &[600.0, 0.0],
        is_choice: &[false, true],
    };

    #[test]
    fn values_are_clamped_to_the_manifest_range_and_nan_is_ignored() {
        let mut bank = ParamBank::new(&RANGES, 960);
        bank.set(INSTRUMENT_BASE, 1e9);
        assert_eq!(bank.get(INSTRUMENT_BASE).start, 8000.0);
        bank.set(INSTRUMENT_BASE, f32::NAN);
        assert_eq!(bank.get(INSTRUMENT_BASE).start, 8000.0);
        bank.set(GAIN, -3.0);
        assert_eq!(bank.get(GAIN).start, 0.0);
    }

    #[test]
    fn reserved_and_unknown_indices_are_ignored() {
        let mut bank = ParamBank::new(&RANGES, 960);
        bank.set(10, 1.0);
        bank.set(INSTRUMENT_BASE + 2, 1.0);
        bank.set(10_000, 1.0);
        assert_eq!(bank.get(10).start, 0.0);
    }

    #[test]
    fn a_choice_jumps_and_never_ramps() {
        let mut bank = ParamBank::new(&RANGES, 960);
        bank.ramp_to(INSTRUMENT_BASE + 1, 3.0, 960);
        assert_eq!(bank.get(INSTRUMENT_BASE + 1).start, 3.0);
        assert_eq!(bank.get(INSTRUMENT_BASE + 1).step, 0.0);
    }

    #[test]
    fn a_locked_index_ignores_outside_writes_but_follows_its_modulator() {
        let mut bank = ParamBank::new(&RANGES, 960);
        bank.lock(INSTRUMENT_BASE, true);
        bank.set(INSTRUMENT_BASE, 2000.0);
        assert_eq!(bank.get(INSTRUMENT_BASE).start, 600.0);
        bank.drive(INSTRUMENT_BASE, 900.0, 0);
        assert_eq!(bank.get(INSTRUMENT_BASE).start, 900.0);
        bank.lock(INSTRUMENT_BASE, false);
        bank.set(INSTRUMENT_BASE, 2000.0);
        assert_eq!(bank.get(INSTRUMENT_BASE).start, 2000.0);
    }

    #[test]
    fn effect_parameters_start_at_their_defaults() {
        let bank = ParamBank::new(&RANGES, 960);
        assert_eq!(bank.get(EFFECT_BASE).start, 20_000.0);
        assert_eq!(bank.get(EFFECT_BASE + 12).start, 1_000.0);
        assert_eq!(bank.get(GLIDE).start, 0.0);
    }

    #[test]
    fn a_ramp_lands_exactly_on_its_target() {
        let mut bank = ParamBank::new(&RANGES, 960);
        bank.ramp_to(INSTRUMENT_BASE, 1400.0, 960);
        let mut left = 960;
        for chunk in [128, 7, 300, 525] {
            assert_eq!(bank.frames_to_next_ramp_end(), Some(left));
            bank.advance(chunk);
            left -= chunk;
        }
        assert_eq!(bank.get(INSTRUMENT_BASE).start, 1400.0);
        assert_eq!(bank.frames_to_next_ramp_end(), None);
    }

    #[test]
    fn switching_space_crossfades_the_bus_weights() {
        let mut bank = ParamBank::new(&RANGES, 960);
        assert_eq!(bank.reverb_weight(1).start, 1.0);
        bank.ramp_to(REVERB_SPACE, 2.0, 960);
        assert_eq!(bank.reverb_weight(1).start, 1.0);
        assert!(bank.reverb_weight(1).step < 0.0);
        assert!(bank.reverb_weight(2).step > 0.0);
        bank.advance(960);
        assert_eq!(bank.reverb_weight(1).start, 0.0);
        assert_eq!(bank.reverb_weight(2).start, 1.0);
    }
}
