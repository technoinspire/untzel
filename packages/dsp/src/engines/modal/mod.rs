// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Modal synthesis: up to 64 two-pole resonators, each with a frequency, a gain and a
//! decay, excited by an impulse, a noise burst, a hammer (low-passed noise whose
//! brightness follows the velocity) or a contact (an impulse plus a short burst of
//! filtered noise; the contact's spectrum is applied per mode by `shape_contact`, and
//! its modes start ringing from scattered phases). Coefficients are computed in `strike` (at most
//! one `cos` per mode); a damper (`damp`) changes only the pole radius. A mode below
//! −80 dB stops being computed.
//!
//! Over 300 lines: its unit tests included; strike, damp and render share the resonator bank.

mod contact;

pub use contact::{hammer_response, shape_contact, slap};

use crate::engines::limit;
use crate::math::{Noise, decay_coefficient, sine};

pub const MAX_MODES: usize = 64;

/// −80 dB: a mode below this is no longer computed.
const MODE_FLOOR: f32 = 1e-4;

/// One mode as the instrument describes it.
#[derive(Clone, Copy, Debug, Default)]
pub struct Mode {
    pub hz: f32,
    /// Amplitude of the mode's response to a unit excitation.
    pub gain: f32,
    /// Seconds to fall 60 dB.
    pub decay: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Exciter {
    Impulse,
    /// White noise burst of this many seconds.
    Noise(f32),
    /// Low-passed noise of this many seconds; the brightness (0..1) sets the filter.
    Hammer(f32),
    /// A short contact: a unit impulse plus `noise` (0..1) of
    /// low-passed noise over `seconds`, for the felt or the thumb. The low-pass of the
    /// contact itself is not in the time signal: `shape_contact` puts it on each mode,
    /// so the upper partials are not cut by a smooth pulse as the `Hammer` does.
    Contact {
        seconds: f32,
        noise: f32,
    },
}

/// A bank of resonators.
pub struct ModalBank<const M: usize> {
    sample_rate: f32,
    a1: [f32; M],
    a2: [f32; M],
    input_gain: [f32; M],
    cos_w: [f32; M],
    /// Normalised frequency of each mode (cycles per sample), for `retune`.
    frequency: [f32; M],
    y1: [f32; M],
    y2: [f32; M],
    count: usize,
    exciter: Exciter,
    excite_left: u32,
    excite_frames: u32,
    excite_level: f32,
    /// Makes a burst of any length excite a low mode about as much as a unit impulse:
    /// the hammer is normalised by its area, the noise burst by its energy.
    excite_scale: f32,
    hammer_coefficient: f32,
    hammer_state: f32,
    /// `Contact`: the level of its noise burst.
    contact_noise: f32,
    noise: Noise,
    peak: f32,
}

impl<const M: usize> ModalBank<M> {
    pub fn new(sample_rate: f32, seed: u32) -> Self {
        ModalBank {
            sample_rate,
            a1: [0.0; M],
            a2: [0.0; M],
            input_gain: [0.0; M],
            cos_w: [0.0; M],
            frequency: [0.0; M],
            y1: [0.0; M],
            y2: [0.0; M],
            count: 0,
            exciter: Exciter::Impulse,
            excite_left: 0,
            excite_frames: 1,
            excite_level: 0.0,
            excite_scale: 1.0,
            hammer_coefficient: 1.0,
            hammer_state: 0.0,
            contact_noise: 0.0,
            noise: Noise::new(seed),
            peak: 0.0,
        }
    }

    /// Sets the modes and starts the excitation. `modes` beyond `M` or above 0.45 × the
    /// sample rate are dropped. The previous ringing is kept (no click on a repeat).
    pub fn strike(&mut self, modes: &[Mode], exciter: Exciter, velocity: f32, brightness: f32) {
        let nyquist = 0.45 * self.sample_rate;
        let mut count = 0;
        for mode in modes.iter().take(M) {
            if mode.hz <= 0.0 || mode.hz >= nyquist || mode.gain <= 0.0 {
                continue;
            }
            self.set_mode(count, mode, exciter, velocity);
            count += 1;
        }
        for index in count..self.count.max(count) {
            self.y1[index] = 0.0;
            self.y2[index] = 0.0;
        }
        self.count = count;
        self.start_excitation(exciter, velocity, brightness);
    }

    /// Sets resonator `index` to `mode` (one `cos`); a contact also sets it ringing.
    fn set_mode(&mut self, index: usize, mode: &Mode, exciter: Exciter, velocity: f32) {
        let w = core::f32::consts::TAU * mode.hz / self.sample_rate;
        let cos_w = w.cos();
        let r = decay_coefficient(mode.decay.max(0.005), self.sample_rate);
        let sin_w = (1.0 - cos_w * cos_w).max(0.0).sqrt();
        self.cos_w[index] = cos_w;
        self.frequency[index] = mode.hz / self.sample_rate;
        self.a1[index] = 2.0 * r * cos_w;
        self.a2[index] = r * r;
        // A unit impulse gives an amplitude close to `gain` at the mode frequency.
        self.input_gain[index] = mode.gain * sin_w.max(1e-3);
        // A mode still ringing at this index keeps its state (no click on a repeat).
        if index >= self.count {
            self.y1[index] = 0.0;
            self.y2[index] = 0.0;
        }
        if let Exciter::Contact { .. } = exciter {
            // The state is added, so a repeat does not click.
            let (y1, y2) = contact::scattered_state(index, mode.gain * velocity, cos_w, sin_w);
            self.y1[index] += y1;
            self.y2[index] += y2;
        }
    }

    /// Starts the time signal of `exciter`: its length, level and noise filter.
    fn start_excitation(&mut self, exciter: Exciter, velocity: f32, brightness: f32) {
        self.exciter = exciter;
        let seconds = match exciter {
            Exciter::Impulse => 0.0,
            Exciter::Noise(seconds) | Exciter::Hammer(seconds) => seconds,
            Exciter::Contact { seconds, .. } => seconds,
        };
        self.excite_frames = ((seconds * self.sample_rate) as u32).max(1);
        self.excite_left = self.excite_frames;
        self.excite_level = velocity;
        let frames = self.excite_frames as f32;
        self.excite_scale = match exciter {
            Exciter::Impulse => 1.0,
            // Σ (1 − p)² ≈ N/3 and the noise has a variance of 1/3.
            Exciter::Noise(_) => 3.0 / frames.sqrt(),
            // Σ 4p(1 − p) ≈ 2N/3 and the filtered noise term averages 0.6.
            Exciter::Hammer(_) => 2.5 / frames,
            // The noise burst of a contact: a third of the energy of the noise exciter
            // (it rings through every mode on top of the struck partials).
            Exciter::Contact { .. } => 1.0 / frames.sqrt(),
        };
        self.contact_noise = match exciter {
            Exciter::Contact { noise, .. } => noise.clamp(0.0, 1.0),
            _ => 0.0,
        };
        let cutoff = 400.0 + 9_000.0 * brightness.clamp(0.0, 1.0) * velocity.max(0.2);
        self.hammer_coefficient = 1.0 - (-core::f32::consts::TAU * cutoff / self.sample_rate).exp();
        self.hammer_state = 0.0;
    }

    /// Changes the decay of every mode to `seconds` (a damper), keeping frequencies.
    pub fn damp(&mut self, seconds: f32) {
        let r = decay_coefficient(seconds.max(0.005), self.sample_rate);
        for index in 0..self.count {
            let current = self.a2[index].sqrt();
            let radius = current.min(r);
            self.a1[index] = 2.0 * radius * self.cos_w[index];
            self.a2[index] = radius * radius;
        }
    }

    /// Moves every mode to `ratio ×` its struck frequency (pitch bends of toms and
    /// drops). Per block, with the parabolic sine of `math`, never `cos`.
    pub fn retune(&mut self, ratio: f32) {
        for index in 0..self.count {
            let cycles = (self.frequency[index] * ratio).min(0.45);
            let cos_w = sine((cycles + 0.25) % 1.0);
            let radius = self.a2[index].sqrt();
            self.cos_w[index] = cos_w;
            self.a1[index] = 2.0 * radius * cos_w;
        }
    }

    /// Adds `gain ×` the bank into `out`; false once every mode is silent.
    pub fn render(&mut self, out: &mut [f32], gain: f32) -> bool {
        let mut peak = 0.0_f32;
        for sample in out.iter_mut() {
            let x = self.excitation();
            let mut sum = 0.0;
            for index in 0..self.count {
                let y = self.a1[index] * self.y1[index] - self.a2[index] * self.y2[index]
                    + self.input_gain[index] * x;
                self.y2[index] = self.y1[index];
                self.y1[index] = y;
                sum += y;
            }
            peak = peak.max(sum.abs());
            *sample += limit(sum * gain);
        }
        if self.excite_left == 0 {
            // Silent modes leave the packed range, so the loop above never branches.
            let mut index = 0;
            while index < self.count {
                if self.y1[index].abs() + self.y2[index].abs() < MODE_FLOOR * 0.1 {
                    self.remove(index);
                } else {
                    index += 1;
                }
            }
        }
        self.peak = peak;
        self.excite_left > 0 || self.count > 0
    }

    /// Swap-removes mode `index` from the packed range of live modes.
    fn remove(&mut self, index: usize) {
        let last = self.count - 1;
        self.a1.swap(index, last);
        self.a2.swap(index, last);
        self.input_gain.swap(index, last);
        self.cos_w.swap(index, last);
        self.frequency.swap(index, last);
        self.y1.swap(index, last);
        self.y2.swap(index, last);
        self.y1[last] = 0.0;
        self.y2[last] = 0.0;
        self.count = last;
    }

    #[inline]
    fn excitation(&mut self) -> f32 {
        if self.excite_left == 0 {
            return 0.0;
        }
        self.excite_left -= 1;
        let progress = 1.0 - self.excite_left as f32 / self.excite_frames as f32;
        match self.exciter {
            Exciter::Impulse => self.excite_level,
            Exciter::Noise(_) => {
                self.excite_level * self.excite_scale * self.noise.sample() * (1.0 - progress)
            }
            Exciter::Hammer(_) => {
                // A raised-cosine-like bump of filtered noise.
                let window = 4.0 * progress * (1.0 - progress);
                self.hammer_state +=
                    self.hammer_coefficient * (self.noise.sample() - self.hammer_state);
                self.excite_level * self.excite_scale * window * (0.6 + 0.4 * self.hammer_state)
            }
            Exciter::Contact { .. } => {
                // The modes were set ringing in `strike`; only the felt's noise remains.
                let window = 4.0 * progress * (1.0 - progress);
                self.hammer_state +=
                    self.hammer_coefficient * (self.noise.sample() - self.hammer_state);
                self.excite_level
                    * self.excite_scale
                    * self.contact_noise
                    * window
                    * self.hammer_state
            }
        }
    }

    /// Loudest absolute sample of the last render.
    pub fn peak(&self) -> f32 {
        self.peak
    }

    /// Fast fade for the voice limit: every mode decays in a few milliseconds.
    pub fn steal(&mut self) {
        self.excite_left = 0;
        self.damp(0.004);
    }

    pub fn reset(&mut self) {
        self.y1 = [0.0; M];
        self.y2 = [0.0; M];
        self.count = 0;
        self.excite_left = 0;
        self.peak = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_struck_mode_rings_at_its_frequency_and_decays() {
        let sample_rate = 48_000.0;
        let mut bank: ModalBank<4> = ModalBank::new(sample_rate, 1);
        bank.strike(
            &[Mode {
                hz: 1_000.0,
                gain: 1.0,
                decay: 0.2,
            }],
            Exciter::Impulse,
            1.0,
            0.5,
        );
        let mut out = vec![0.0; 48_000];
        bank.render(&mut out, 1.0);
        let crossings = out[..4_800]
            .windows(2)
            .filter(|w| w[0] <= 0.0 && w[1] > 0.0)
            .count();
        assert!((crossings as i32 - 100).abs() <= 2, "{crossings}");
        let early = out[..480].iter().fold(0.0_f32, |m, x| m.max(x.abs()));
        let late = out[9_600..10_080]
            .iter()
            .fold(0.0_f32, |m, x| m.max(x.abs()));
        // 0.2 s for 60 dB: after 0.2 s the level is about 1/1000 of the start.
        assert!(
            late < early * 0.002 && late > early * 0.0005,
            "{early} {late}"
        );
        assert!((early - 1.0).abs() < 0.1, "{early}");
    }

    #[test]
    fn a_hammer_burst_excites_a_low_mode_about_as_much_as_an_impulse() {
        let sample_rate = 48_000.0;
        let mode = Mode {
            hz: 100.0,
            gain: 1.0,
            decay: 1.0,
        };
        let mut peaks = [0.0_f32; 2];
        for (index, exciter) in [Exciter::Impulse, Exciter::Hammer(0.004)]
            .into_iter()
            .enumerate()
        {
            let mut bank: ModalBank<1> = ModalBank::new(sample_rate, 7);
            bank.strike(&[mode], exciter, 1.0, 0.5);
            let mut out = vec![0.0; 4_800];
            bank.render(&mut out, 1.0);
            peaks[index] = out.iter().fold(0.0_f32, |m, x| m.max(x.abs()));
        }
        let ratio = peaks[1] / peaks[0];
        assert!((0.5..1.5).contains(&ratio), "hammer ÷ impulse = {ratio}");
    }

    #[test]
    fn a_contact_rings_a_high_mode_that_the_hammer_cuts() {
        let sample_rate = 48_000.0;
        let mode = Mode {
            hz: 2_000.0,
            gain: 1.0,
            decay: 0.5,
        };
        let mut peaks = [0.0_f32; 2];
        let exciters = [
            Exciter::Hammer(0.004),
            Exciter::Contact {
                seconds: 0.004,
                noise: 0.0,
            },
        ];
        for (index, exciter) in exciters.into_iter().enumerate() {
            let mut bank: ModalBank<1> = ModalBank::new(sample_rate, 7);
            bank.strike(&[mode], exciter, 1.0, 0.5);
            let mut out = vec![0.0; 4_800];
            bank.render(&mut out, 1.0);
            peaks[index] = out.iter().fold(0.0_f32, |m, x| m.max(x.abs()));
        }
        assert!(
            peaks[1] > 10.0 * peaks[0],
            "contact {} hammer {}",
            peaks[1],
            peaks[0]
        );
        assert!(
            (peaks[1] - 1.0).abs() < 0.1,
            "a unit impulse rings at the mode gain"
        );
    }

    #[test]
    fn a_damper_shortens_the_ring() {
        let mut bank: ModalBank<2> = ModalBank::new(48_000.0, 1);
        bank.strike(
            &[Mode {
                hz: 440.0,
                gain: 1.0,
                decay: 5.0,
            }],
            Exciter::Impulse,
            1.0,
            0.5,
        );
        let mut out = vec![0.0; 480];
        bank.render(&mut out, 1.0);
        bank.damp(0.05);
        let mut tail = vec![0.0; 9_600];
        assert!(!bank.render(&mut tail, 1.0) || tail[9_000..].iter().all(|x| x.abs() < 1e-3));
    }
}
