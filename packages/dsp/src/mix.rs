// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Bus buffers of one sub-block and the per-sample mix of a slot into them: gain (times
//! `audible`), duck, pan, then the six smoothed sends.
//! Pan is a constant-power law scaled to unity at the centre: a centred track
//! is untouched, and a track moved to one side keeps its loudness instead of losing 3 dB.

use crate::params::{DELAY_DIVISIONS, DELAY_SEND, DUCK, PAN, REVERB_SEND, REVERB_SPACES, Ramped};
use crate::slot::{BLOCK, Slot, SlotOutput};

pub type Stereo = [[f32; BLOCK]; 2];

pub struct Buses {
    pub dry: Stereo,
    pub reverb: [Stereo; REVERB_SPACES],
    pub delay: [Stereo; DELAY_DIVISIONS],
    /// Summed `kick` signal, turned into the duck envelope in place.
    pub sidechain: [f32; BLOCK],
}

impl Buses {
    pub fn new() -> Self {
        Buses {
            dry: [[0.0; BLOCK]; 2],
            reverb: [[[0.0; BLOCK]; 2]; REVERB_SPACES],
            delay: [[[0.0; BLOCK]; 2]; DELAY_DIVISIONS],
            sidechain: [0.0; BLOCK],
        }
    }

    /// Zeroes the first `len` samples of every bus.
    pub fn clear(&mut self, len: usize) {
        let stereo = core::iter::once(&mut self.dry)
            .chain(self.reverb.iter_mut())
            .chain(self.delay.iter_mut());
        for buffer in stereo.flat_map(|channels| channels.iter_mut()) {
            buffer[..len].fill(0.0);
        }
        self.sidechain[..len].fill(0.0);
    }

    /// Adds the slot's signal into the sidechain input, before its `gain`: a
    /// quieter kick keeps the bass pumping; a muted kick stops it.
    pub fn feed_sidechain(&mut self, slot: &Slot, offset: usize, len: usize) {
        let gain = slot.params.output_gain();
        let output = slot.output(offset, len);
        for (n, input) in self.sidechain[..len].iter_mut().enumerate() {
            *input += output.mono_at(n) * gain.audible_at(n);
        }
    }

    /// Mixes the slot into the dry bus and its sends; `envelope` is the duck envelope.
    pub fn mix(&mut self, slot: &Slot, offset: usize, len: usize) {
        let params = &slot.params;
        let (gain, duck, pan) = (params.output_gain(), params.get(DUCK), params.get(PAN));
        let mut panned: Stereo = [[0.0; BLOCK]; 2];
        match slot.output(offset, len) {
            // The plain mono path, untouched: the bit-identity test reads it.
            SlotOutput::Mono(signal) => {
                for n in 0..len {
                    let x = signal[n] * gain.at(n) * (1.0 - duck.at(n) * self.sidechain[n]);
                    let [l, r] = pan_gains(pan.at(n));
                    panned[0][n] = x * l;
                    panned[1][n] = x * r;
                }
            }
            // With effects `pan` is a balance with the same law.
            SlotOutput::Stereo(left, right) => {
                for n in 0..len {
                    let scale = gain.at(n) * (1.0 - duck.at(n) * self.sidechain[n]);
                    let [l, r] = pan_gains(pan.at(n));
                    panned[0][n] = left[n] * scale * l;
                    panned[1][n] = right[n] * scale * r;
                }
            }
        }
        for (bus, channel) in self.dry.iter_mut().zip(&panned) {
            for (out, x) in bus[..len].iter_mut().zip(&channel[..len]) {
                *out += x;
            }
        }
        let reverb_send = params.get(REVERB_SEND);
        let delay_send = params.get(DELAY_SEND);
        for bus in 0..REVERB_SPACES {
            send(
                &panned,
                &mut self.reverb[bus],
                reverb_send,
                params.reverb_weight(bus),
                len,
            );
        }
        for bus in 0..DELAY_DIVISIONS {
            send(
                &panned,
                &mut self.delay[bus],
                delay_send,
                params.delay_weight(bus),
                len,
            );
        }
    }
}

impl Default for Buses {
    fn default() -> Self {
        Self::new()
    }
}

/// Left and right gains of `pan` (−1..1): constant power, √2·cos and √2·sin of
/// (pan + 1)·π/4, so the centre is exactly 1 on both sides and L² + R² stays 2.
#[inline]
pub fn pan_gains(pan: f32) -> [f32; 2] {
    if pan == 0.0 {
        return [1.0, 1.0];
    }
    let angle = (pan.clamp(-1.0, 1.0) + 1.0) * core::f32::consts::FRAC_PI_4;
    [
        core::f32::consts::SQRT_2 * angle.cos(),
        core::f32::consts::SQRT_2 * angle.sin(),
    ]
}
/// Adds `source × amount × weight` into `bus`, skipping a send that is zero throughout.
fn send(source: &Stereo, bus: &mut Stereo, amount: Ramped, weight: Ramped, len: usize) {
    if amount.is_silent(len) || weight.is_silent(len) {
        return;
    }
    for (input, output) in source.iter().zip(bus.iter_mut()) {
        for n in 0..len {
            output[n] += input[n] * amount.at(n) * weight.at(n);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::pan_gains;
    #[test]
    fn centre_is_unity_and_power_stays_constant() {
        assert_eq!(pan_gains(0.0), [1.0, 1.0]);
        for pan in [-1.0_f32, -0.5, -0.1, 0.3, 1.0] {
            let [l, r] = pan_gains(pan);
            assert!((l * l + r * r - 2.0).abs() < 1e-5, "power at {pan}");
        }
        let [l, r] = pan_gains(-1.0);
        assert!((l - core::f32::consts::SQRT_2).abs() < 1e-5 && r.abs() < 1e-6);
    }
}
