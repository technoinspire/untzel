// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Plucked string (Karplus-Strong): a delay line sized by the sample rate for the
//! lowest piano note (a0, 27.5 Hz), a fractional read, a loss filter that sets the
//! brightness and a loop gain that sets the decay. The pluck fills the line with
//! filtered noise shaped by the picking position. A note below 27.5 Hz rises by
//! octaves until it fits.
//!
//! The line is allocated once in `new` (message handler); `reset` zeroes it in place.

use crate::engines::env::Decay;
use crate::engines::{limit, played_note};
use crate::math::{Noise, SILENCE, Svf, decay_coefficient, filter_gain, midi_to_hz};

/// The lowest note a line holds.
pub const LOWEST_HZ: f32 = 27.5;

/// Samples of a line at `sample_rate`: `ceil(sample_rate / 27.5) + 4`.
pub fn line_length(sample_rate: f32) -> usize {
    (sample_rate / LOWEST_HZ).ceil() as usize + 4
}

/// Frequency that fits the line: below 27.5 Hz it rises by octaves.
pub fn fitted_hz(hz: f32) -> f32 {
    let mut hz = hz.max(1.0);
    while hz < LOWEST_HZ {
        hz *= 2.0;
    }
    hz
}

#[derive(Clone, Copy, Debug)]
pub struct StringControls {
    /// 0 dark .. 1 bright.
    pub brightness: f32,
    /// Seconds to fall 60 dB while held.
    pub decay: f32,
    /// Picking position 0..1 (0.5 is the middle, hollow).
    pub position: f32,
    /// Body resonance mix 0..1.
    pub body: f32,
    /// Seconds to fall 60 dB after the note ends.
    pub release: f32,
}

/// One string.
pub struct KarplusString {
    sample_rate: f32,
    line: Box<[f32]>,
    write: usize,
    /// Loop delay in samples (fractional).
    delay: f32,
    loss_state: f32,
    gate_left: u32,
    level: Decay,
    active: bool,
    noise: Noise,
    hz: f32,
}

impl KarplusString {
    pub fn new(sample_rate: f32, seed: u32) -> Self {
        KarplusString {
            sample_rate,
            line: vec![0.0; line_length(sample_rate)].into_boxed_slice(),
            write: 0,
            delay: 100.0,
            loss_state: 0.0,
            gate_left: 0,
            level: Decay::default(),
            active: false,
            noise: Noise::new(seed),
            hz: 110.0,
        }
    }

    pub fn line_len(&self) -> usize {
        self.line.len()
    }

    /// Plucks `hz` (already fitted) at `velocity`.
    pub fn pluck(
        &mut self,
        hz: f32,
        velocity: f32,
        duration_frames: u32,
        controls: &StringControls,
    ) {
        let hz = fitted_hz(hz).min(0.4 * self.sample_rate);
        self.hz = hz;
        // The loss filter adds about half a sample of delay.
        self.delay = (self.sample_rate / hz - 0.5).clamp(2.0, (self.line.len() - 3) as f32);
        let period = self.delay.ceil() as usize;
        let len = self.line.len();
        let brightness = controls.brightness.clamp(0.0, 1.0);
        let smoothing = 0.15 + 0.8 * brightness;
        let pick = ((controls.position.clamp(0.02, 0.98) * period as f32) as usize).max(1);
        let mut previous = 0.0;
        // Fill one period behind the write head with shaped noise; existing energy is
        // kept (a repluck of a ringing string does not click).
        for i in 0..period {
            let raw = self.noise.sample();
            previous += smoothing * (raw - previous);
            let index = (self.write + len - period + i) % len;
            self.line[index] = 0.5 * self.line[index] + previous * velocity;
        }
        // Picking position: a comb on the excitation.
        for i in (pick..period).rev() {
            let a = (self.write + len - period + i) % len;
            let b = (self.write + len - period + i - pick) % len;
            self.line[a] -= 0.5 * self.line[b];
        }
        self.gate_left = duration_frames.max(1);
        self.level.trigger(1.0, 0.0, self.sample_rate);
        self.active = true;
    }

    /// Adds `gain ×` the string into `out`; false once silent.
    pub fn render(&mut self, out: &mut [f32], gain: f32, controls: &StringControls) -> bool {
        if !self.active {
            return false;
        }
        let len = self.line.len();
        let held = decay_coefficient(
            controls.decay.max(0.05),
            self.sample_rate / self.delay.max(1.0),
        );
        let released = decay_coefficient(
            controls.release.max(0.01),
            self.sample_rate / self.delay.max(1.0),
        );
        let loss = 0.25 + 0.7 * controls.brightness.clamp(0.0, 1.0);
        let whole = self.delay.floor();
        let fraction = self.delay - whole;
        let whole = whole as usize;
        let mut peak = 0.0_f32;
        for sample in out.iter_mut() {
            let feedback = if self.gate_left > 0 { held } else { released };
            self.gate_left = self.gate_left.saturating_sub(1);
            let a = self.line[(self.write + len - whole) % len];
            let b = self.line[(self.write + len - whole - 1) % len];
            let delayed = a + fraction * (b - a);
            self.loss_state += loss * (delayed - self.loss_state);
            let value = self.loss_state * feedback;
            self.line[self.write] = value;
            self.write = (self.write + 1) % len;
            peak = peak.max(value.abs());
            *sample += limit(value * gain);
        }
        self.active = peak > SILENCE * 0.1;
        self.active
    }

    pub fn is_released(&self) -> bool {
        self.gate_left == 0
    }

    /// Fast fade (voice limit).
    pub fn steal(&mut self) {
        self.gate_left = 0;
        for value in self.line.iter_mut() {
            *value *= 0.25;
        }
    }

    pub fn level(&self) -> f32 {
        if self.active {
            self.loss_state.abs().max(SILENCE)
        } else {
            0.0
        }
    }

    pub fn hz(&self) -> f32 {
        self.hz
    }

    /// Clears in place: the line is zeroed, never reallocated.
    pub fn reset(&mut self) {
        self.line.fill(0.0);
        self.write = 0;
        self.loss_state = 0.0;
        self.gate_left = 0;
        self.active = false;
        self.level.reset();
    }
}

/// A body resonance: two broad band-passes summed with the dry string.
#[derive(Clone, Copy, Default)]
pub struct Body {
    low: Svf,
    high: Svf,
}

impl Body {
    #[inline]
    pub fn process(
        &mut self,
        x: f32,
        amount: f32,
        sample_rate: f32,
        low_hz: f32,
        high_hz: f32,
    ) -> f32 {
        let low = self
            .low
            .process(x, filter_gain(low_hz, sample_rate), 0.9)
            .band;
        let high = self
            .high
            .process(x, filter_gain(high_hz, sample_rate), 1.2)
            .band;
        x + amount * (1.6 * low + 0.8 * high)
    }

    pub fn reset(&mut self) {
        *self = Body::default();
    }
}

/// Frequency of a midi note (hits use `HIT_NOTE`).
pub fn note_hz(note: f32) -> f32 {
    midi_to_hz(played_note(note))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CONTROLS: StringControls = StringControls {
        brightness: 0.6,
        decay: 3.0,
        position: 0.3,
        body: 0.4,
        release: 0.2,
    };

    #[test]
    fn the_line_is_sized_by_the_sample_rate() {
        for rate in [44_100.0, 48_000.0, 96_000.0, 192_000.0] {
            let string = KarplusString::new(rate, 1);
            assert_eq!(string.line_len(), (rate / 27.5_f32).ceil() as usize + 4);
        }
    }

    #[test]
    fn a_note_below_a0_rises_by_octaves() {
        assert_eq!(fitted_hz(13.75), 27.5);
        assert_eq!(fitted_hz(10.0), 40.0);
        let mut string = KarplusString::new(48_000.0, 1);
        string.pluck(8.0, 1.0, 1000, &CONTROLS);
        assert!(string.hz() >= LOWEST_HZ);
    }

    #[test]
    fn a_pluck_rings_then_decays_and_stays_finite_at_every_rate() {
        for rate in [44_100.0, 48_000.0, 96_000.0, 192_000.0] {
            let mut string = KarplusString::new(rate, 7);
            string.pluck(220.0, 1.0, (0.5 * rate) as u32, &CONTROLS);
            let mut out = vec![0.0; (0.2 * rate) as usize];
            string.render(&mut out, 1.0, &CONTROLS);
            let early = out.iter().fold(0.0_f32, |m, x| m.max(x.abs()));
            assert!(early > 0.05 && out.iter().all(|x| x.is_finite()), "{rate}");
            let mut tail = vec![0.0; (4.0 * rate) as usize];
            string.render(&mut tail, 1.0, &CONTROLS);
            let late = tail[tail.len() - 1000..]
                .iter()
                .fold(0.0_f32, |m, x| m.max(x.abs()));
            assert!(late < early * 0.01, "{rate}: {late} vs {early}");
        }
    }

    #[test]
    fn reset_keeps_the_same_line() {
        let mut string = KarplusString::new(48_000.0, 1);
        let address = string.line.as_ptr();
        string.pluck(220.0, 1.0, 1000, &CONTROLS);
        string.reset();
        assert_eq!(string.line.as_ptr(), address);
        assert!(string.line.iter().all(|&x| x == 0.0));
    }
}
