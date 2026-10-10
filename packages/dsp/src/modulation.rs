// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Fast signals and per-note envelopes of one slot. Up to eight, one per parameter. Every `UPDATE_FRAMES` the slot asks
//! each one for its value and ramps the parameter there linearly, so the engine's
//! per-sample scheduling keeps every ramp exact.
//!
//! The LFO phase comes from the frame, never from accumulated state:
//! `phase = frac((frame − origin) / period)`. Nothing here allocates.
//!
//! Over 300 lines: its unit tests included; every shape shares the slot's update step on the audio thread.

use crate::engines::fast_exp2;
use crate::math::sine;

pub const MAX_MODULATORS: usize = 8;
/// A modulated parameter is recomputed this often (frames).
pub const UPDATE_FRAMES: u32 = 32;

pub const SHAPE_SINE: u32 = 0;
pub const SHAPE_TRIANGLE: u32 = 1;
pub const SHAPE_SAW: u32 = 2;
pub const SHAPE_SQUARE: u32 = 3;
pub const CURVE_LINEAR: u32 = 0;
pub const CURVE_EXPONENTIAL: u32 = 1;

#[derive(Clone, Copy, Debug, PartialEq)]
enum Source {
    Lfo {
        shape: u32,
        period: f64,
        origin: f64,
    },
    /// Reaches 99% of the way in `seconds` after every note.
    Envelope { seconds: f32 },
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Modulator {
    param: usize,
    source: Source,
    exponential: bool,
    low: f32,
    high: f32,
    /// log2(high / low) for the exponential curve.
    octaves: f32,
}

impl Modulator {
    /// Position 0..1 along the range at `frame`; `note_frame` is the last note start.
    fn position(&self, frame: f64, note_frame: f64, sample_rate: f32) -> f32 {
        match self.source {
            Source::Lfo {
                shape,
                period,
                origin,
            } => {
                let cycles = (frame - origin) / period;
                let phase = (cycles - cycles.floor()) as f32;
                match shape {
                    SHAPE_SINE => 0.5 + 0.5 * sine((phase + 0.75) % 1.0),
                    SHAPE_TRIANGLE => {
                        if phase < 0.5 {
                            2.0 * phase
                        } else {
                            2.0 - 2.0 * phase
                        }
                    }
                    SHAPE_SAW => phase,
                    _ => {
                        if phase < 0.5 {
                            0.0
                        } else {
                            1.0
                        }
                    }
                }
            }
            Source::Envelope { seconds } => {
                if note_frame < 0.0 {
                    return 0.0;
                }
                let elapsed = ((frame - note_frame) / f64::from(sample_rate)) as f32;
                // 99% of the way (e^-4.6) at `seconds`.
                1.0 - (-4.605_17 * elapsed.max(0.0) / seconds.max(0.001)).exp()
            }
        }
    }

    fn value(&self, position: f32) -> f32 {
        if self.exponential {
            self.low * fast_exp2(self.octaves * position)
        } else {
            self.low + (self.high - self.low) * position
        }
    }
}

/// The modulators of one slot.
pub struct Modulators {
    items: [Option<Modulator>; MAX_MODULATORS],
    next_update: f64,
    note_frame: f64,
    /// A note started since the last update: envelopes jump to their start.
    restart: bool,
}

/// A value the slot ramps a parameter to, in `UPDATE_FRAMES`; `from`, when set, is a
/// value to jump to first (an envelope restarting on a note).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Drive {
    pub param: usize,
    pub value: f32,
    pub from: Option<f32>,
}

impl Drive {
    pub const NONE: Drive = Drive {
        param: 0,
        value: 0.0,
        from: None,
    };
}

impl Default for Modulators {
    fn default() -> Self {
        Self::new()
    }
}

impl Modulators {
    pub const fn new() -> Self {
        Modulators {
            items: [None; MAX_MODULATORS],
            next_update: f64::NEG_INFINITY,
            note_frame: -1.0,
            restart: false,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.items.iter().all(Option::is_none)
    }

    fn place(&mut self, modulator: Modulator) -> bool {
        if let Some(slot) = self
            .items
            .iter_mut()
            .find(|item| item.is_some_and(|m| m.param == modulator.param))
        {
            *slot = Some(modulator);
            self.next_update = f64::NEG_INFINITY;
            return true;
        }
        match self.items.iter_mut().find(|item| item.is_none()) {
            Some(slot) => {
                *slot = Some(modulator);
                self.next_update = f64::NEG_INFINITY;
                true
            }
            None => false,
        }
    }

    fn checked(curve: u32, low: f32, high: f32) -> Option<(bool, f32)> {
        if curve > CURVE_EXPONENTIAL || !low.is_finite() || !high.is_finite() {
            return None;
        }
        let exponential = curve == CURVE_EXPONENTIAL;
        if exponential && (low <= 0.0 || high <= 0.0) {
            return None;
        }
        let octaves = if exponential {
            (high / low).log2()
        } else {
            0.0
        };
        Some((exponential, octaves))
    }

    /// An LFO on `param`; false when refused (the ninth, a bad shape, curve or period).
    #[allow(clippy::too_many_arguments)]
    pub fn set_lfo(
        &mut self,
        param: usize,
        shape: u32,
        curve: u32,
        period_frames: f64,
        origin_frame: f64,
        low: f32,
        high: f32,
    ) -> bool {
        if shape > SHAPE_SQUARE
            || !(period_frames.is_finite() && period_frames > 0.0)
            || !origin_frame.is_finite()
        {
            return false;
        }
        let Some((exponential, octaves)) = Self::checked(curve, low, high) else {
            return false;
        };
        let source = Source::Lfo {
            shape,
            period: period_frames,
            origin: origin_frame,
        };
        self.place(Modulator {
            param,
            source,
            exponential,
            low,
            high,
            octaves,
        })
    }

    /// A per-note envelope on `param`.
    pub fn set_envelope(
        &mut self,
        param: usize,
        curve: u32,
        seconds: f32,
        from: f32,
        to: f32,
    ) -> bool {
        if !(seconds.is_finite() && seconds > 0.0) {
            return false;
        }
        let Some((exponential, octaves)) = Self::checked(curve, from, to) else {
            return false;
        };
        let source = Source::Envelope { seconds };
        self.place(Modulator {
            param,
            source,
            exponential,
            low: from,
            high: to,
            octaves,
        })
    }

    /// Removes the modulator of `param`; false when there is none.
    pub fn clear(&mut self, param: usize) -> bool {
        match self
            .items
            .iter_mut()
            .find(|item| item.is_some_and(|m| m.param == param))
        {
            Some(slot) => {
                *slot = None;
                true
            }
            None => false,
        }
    }

    pub fn note_started(&mut self, frame: f64) {
        self.note_frame = frame;
        if self
            .items
            .iter()
            .flatten()
            .any(|m| matches!(m.source, Source::Envelope { .. }))
        {
            self.next_update = f64::NEG_INFINITY;
            self.restart = true;
        }
    }

    /// The drives due at `frame`, written into `out`; returns how many.
    pub fn due(
        &mut self,
        frame: f64,
        sample_rate: f32,
        out: &mut [Drive; MAX_MODULATORS],
    ) -> usize {
        if frame < self.next_update {
            return 0;
        }
        self.next_update = frame + f64::from(UPDATE_FRAMES);
        let target = frame + f64::from(UPDATE_FRAMES);
        let restart = core::mem::take(&mut self.restart);
        let mut count = 0;
        for modulator in self.items.iter().flatten() {
            let value = modulator.value(modulator.position(target, self.note_frame, sample_rate));
            let from = match modulator.source {
                Source::Envelope { .. } if restart => {
                    Some(modulator.value(modulator.position(frame, self.note_frame, sample_rate)))
                }
                _ => None,
            };
            out[count] = Drive {
                param: modulator.param,
                value,
                from,
            };
            count += 1;
        }
        count
    }

    pub fn params(&self) -> impl Iterator<Item = usize> + '_ {
        self.items.iter().flatten().map(|m| m.param)
    }

    /// Forgets the last note and recomputes on the next update (stop, NaN recovery).
    pub fn reset(&mut self) {
        self.note_frame = -1.0;
        self.restart = false;
        self.next_update = f64::NEG_INFINITY;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn drives() -> [Drive; MAX_MODULATORS] {
        [Drive::NONE; MAX_MODULATORS]
    }

    #[test]
    fn the_phase_comes_from_the_frame_not_from_history() {
        let mut a = Modulators::new();
        let mut b = Modulators::new();
        a.set_lfo(40, SHAPE_SINE, CURVE_LINEAR, 4_800.0, 0.0, 0.0, 1.0);
        b.set_lfo(40, SHAPE_SINE, CURVE_LINEAR, 4_800.0, 0.0, 0.0, 1.0);
        let mut out_a = drives();
        let mut out_b = drives();
        // a is asked every 32 frames, b only once at the end.
        for frame in (0..10_000).step_by(32) {
            a.due(f64::from(frame), 48_000.0, &mut out_a);
        }
        let frame = f64::from(9_984_u32 + 32);
        a.due(frame, 48_000.0, &mut out_a);
        b.due(frame, 48_000.0, &mut out_b);
        assert_eq!(out_a[0].value, out_b[0].value);
    }

    #[test]
    fn exponential_curves_pass_through_the_same_values_whatever_the_period() {
        let mut slow = Modulators::new();
        let mut fast = Modulators::new();
        slow.set_lfo(
            40,
            SHAPE_SAW,
            CURVE_EXPONENTIAL,
            9_600.0,
            0.0,
            300.0,
            2400.0,
        );
        fast.set_lfo(
            40,
            SHAPE_SAW,
            CURVE_EXPONENTIAL,
            4_800.0,
            0.0,
            300.0,
            2400.0,
        );
        let mut a = drives();
        let mut b = drives();
        slow.due(2_400.0 - 32.0, 48_000.0, &mut a);
        fast.due(1_200.0 - 32.0, 48_000.0, &mut b);
        assert!(
            (a[0].value - b[0].value).abs() < 0.5,
            "{} {}",
            a[0].value,
            b[0].value
        );
        // A quarter of a saw on 300..2400 exponential: 300 × 8^0.25.
        assert!((a[0].value - 300.0 * 8.0_f32.powf(0.25)).abs() < 1.0);
    }

    #[test]
    fn an_envelope_restarts_with_every_note() {
        let mut modulators = Modulators::new();
        modulators.set_envelope(40, CURVE_LINEAR, 0.1, 0.0, 1.0);
        let mut out = drives();
        modulators.note_started(0.0);
        modulators.due(4_800.0, 48_000.0, &mut out);
        assert!(out[0].value > 0.98);
        modulators.note_started(4_900.0);
        modulators.due(4_900.0, 48_000.0, &mut out);
        assert!(out[0].value < 0.3);
        assert_eq!(
            out[0].from,
            Some(0.0),
            "the envelope jumps back to its start"
        );
    }

    #[test]
    fn the_ninth_and_bad_inputs_are_refused() {
        let mut modulators = Modulators::new();
        for param in 0..8 {
            assert!(modulators.set_lfo(32 + param, SHAPE_SINE, CURVE_LINEAR, 100.0, 0.0, 0.0, 1.0));
        }
        assert!(!modulators.set_lfo(50, SHAPE_SINE, CURVE_LINEAR, 100.0, 0.0, 0.0, 1.0));
        assert!(
            modulators.set_lfo(32, SHAPE_SAW, CURVE_LINEAR, 100.0, 0.0, 0.0, 1.0),
            "replacing is fine"
        );
        assert!(!Modulators::new().set_lfo(32, 4, CURVE_LINEAR, 100.0, 0.0, 0.0, 1.0));
        assert!(!Modulators::new().set_lfo(32, SHAPE_SINE, 2, 100.0, 0.0, 0.0, 1.0));
        assert!(!Modulators::new().set_lfo(32, SHAPE_SINE, CURVE_LINEAR, 0.0, 0.0, 0.0, 1.0));
        assert!(!Modulators::new().set_lfo(32, SHAPE_SINE, CURVE_LINEAR, 10.0, 0.0, f32::NAN, 1.0));
        assert!(!modulators.clear(99));
        assert!(modulators.clear(33));
    }

    /// The light reads the same values: `packages/core/src/pattern/modulator-position.ts`
    /// is a port checked against this file, which this engine must keep producing.
    #[test]
    fn light_vectors() {
        let vectors = include_str!("../vectors/modulators.txt");
        let mut checked = 0;
        for line in vectors
            .lines()
            .filter(|line| !line.starts_with('#') && !line.is_empty())
        {
            let fields: Vec<&str> = line.split_whitespace().collect();
            let number = |index: usize| -> f64 { fields[index].parse().unwrap() };
            let mut modulators = Modulators::new();
            let (frame, expected) = if fields[0] == "lfo" {
                let shape = number(1) as u32;
                let curve = number(2) as u32;
                assert!(modulators.set_lfo(
                    40,
                    shape,
                    curve,
                    number(3),
                    number(4),
                    number(5) as f32,
                    number(6) as f32
                ));
                (number(7), number(9) as f32)
            } else {
                assert!(modulators.set_envelope(
                    40,
                    number(1) as u32,
                    number(2) as f32,
                    number(3) as f32,
                    number(4) as f32
                ));
                modulators.note_started(number(6));
                (number(5), number(7) as f32)
            };
            let mut out = drives();
            assert_eq!(
                modulators.due(frame - f64::from(UPDATE_FRAMES), 48_000.0, &mut out),
                1,
                "{line}"
            );
            let tolerance = 1e-6 * expected.abs().max(1.0);
            assert!(
                (out[0].value - expected).abs() <= tolerance,
                "{line}: {}",
                out[0].value
            );
            checked += 1;
        }
        assert!(checked >= 50);
    }
}
