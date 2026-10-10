// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The contact of a stick, a hand or a beater on a drum head: a burst of
//! band-passed noise of a few milliseconds that does not go through the resonances. A
//! modal drum without it starts like a struck bell, soft and round; with it, the ear hears
//! the hit before the pitch, as on a recorded drum.

use crate::math::{Noise, SILENCE, Svf, decay_coefficient, filter_gain};

/// Damping of the band-pass (wide: a contact is noise, not a tone).
const DAMPING: f32 = 1.8;

pub struct Skin {
    noise: Noise,
    filter: Svf,
    gain: f32,
    level: f32,
    decay: f32,
}

impl Skin {
    pub fn new(seed: u32) -> Self {
        Skin {
            noise: Noise::new(seed),
            filter: Svf::default(),
            gain: 0.0,
            level: 0.0,
            decay: 0.0,
        }
    }

    /// Starts a contact of `level` centred on `hz`, gone (−60 dB) in `seconds`.
    pub fn strike(&mut self, level: f32, hz: f32, seconds: f32, sample_rate: f32) {
        self.level = level;
        self.gain = filter_gain(hz.min(0.4 * sample_rate), sample_rate);
        self.decay = decay_coefficient(seconds.max(0.0005), sample_rate);
    }

    /// Adds the contact into `out`; false once it is silent.
    pub fn render(&mut self, out: &mut [f32]) -> bool {
        if self.level <= SILENCE {
            return false;
        }
        for sample in out.iter_mut() {
            let band = self
                .filter
                .process(self.noise.sample(), self.gain, DAMPING)
                .band;
            *sample += band * self.level;
            self.level *= self.decay;
        }
        self.level > SILENCE
    }

    pub fn reset(&mut self) {
        self.level = 0.0;
        self.filter = Svf::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_contact_is_loud_at_first_and_gone_after_its_time() {
        let mut skin = Skin::new(7);
        skin.strike(1.0, 3_000.0, 0.01, 48_000.0);
        let mut out = vec![0.0; 960];
        assert!(skin.render(&mut out[..240]));
        let still_sounding = skin.render(&mut out[240..]);
        let early: f32 = out[..96].iter().map(|x| x * x).sum();
        let late: f32 = out[480..].iter().map(|x| x * x).sum();
        assert!(early > 0.01 && late < early * 1e-4, "{early} {late}");
        assert!(!still_sounding);
    }
}
