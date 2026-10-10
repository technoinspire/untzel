// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
//! Voice of `impact`: the hit at a section change. A sub layer that
//! drops an octave slowly (not the kick's fast pitch envelope), a burst of noise sent
//! into a diffuse tail (`tail`, the reverberated noise, ringing for `decay`) and, with
//! `color`, a metal crash. `size` deepens the sub and lengthens the drop.
use crate::engines::env::Decay;
use crate::engines::limit;
use crate::engines::percussion::{FilteredNoise, Metal, NoiseShape, Tone};
use crate::engines::wash::Wash;
use crate::math::{Svf, filter_gain};
use crate::voice::{Params, Voice};

const LEVEL: f32 = 0.5731;
/// Level of the diffuse tail against the dry layers: the burst that feeds it lasts
/// tens of milliseconds and the tail spreads it over seconds, so it needs this gain to
/// sit level with the sub at `tail` 1.
const TAIL_LEVEL: f32 = 60.0;
/// Below this `tail` the dry layers are lifted by `DRY_LIFT` per unit.
const TAIL_RESTING: f32 = 0.6;
const DRY_LIFT: f32 = 1.2;

pub struct ImpactVoice {
    sample_rate: f32,
    sub: Tone,
    noise: FilteredNoise,
    wash: Wash,
    metal: Metal,
    metal_amp: Decay,
    metal_filter: Svf,
    velocity: f32,
}

impl Voice for ImpactVoice {
    fn new(sample_rate: f32) -> Self {
        ImpactVoice {
            sample_rate,
            sub: Tone::new(),
            noise: FilteredNoise::new(0x696d_7061),
            wash: Wash::new(sample_rate),
            metal: Metal::default(),
            metal_amp: Decay::default(),
            metal_filter: Svf::default(),
            velocity: 0.0,
        }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, _duration_frames: u32, params: &Params) {
        let size = params.at(super::SIZE, 0);
        // `decay` is how long the hit stays within 20 dB of its peak: the layers fall
        // 60 dB in three times that.
        let decay = 3.0 * params.at(super::DECAY, 0);
        let color = params.at(super::COLOR, 0);
        let low = 90.0 - 45.0 * size;
        // The sub falls an octave over a few hundred milliseconds.
        self.sub.trigger(low, low * 0.5, 0.25 + 0.5 * size, 0.45 - 0.2 * color, decay, self.sample_rate);
        self.noise.amp.trigger(0.12, 0.05 + 0.1 * size, self.sample_rate);
        self.wash.set_decay(decay);
        self.metal_amp.trigger(color, decay * 0.5, self.sample_rate);
        self.velocity = velocity;
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let g = filter_gain(6_000.0, self.sample_rate);
        let tail_amount = params.at(super::TAIL, 0);
        let tail = tail_amount * TAIL_LEVEL;
        // A dry hit (little tail) carries its level in the sub and the burst.
        let dry = 1.0 + DRY_LIFT * (TAIL_RESTING - tail_amount).max(0.0);
        for sample in out.iter_mut() {
            let sub = self.sub.next(self.sample_rate);
            let noise = self.noise.next(NoiseShape::Low, 4_000.0, 1.2, 0.6, self.sample_rate);
            let wash = self.wash.process(noise);
            let metal = self.metal_filter.process(self.metal.next(380.0, self.sample_rate), g, 0.8).high * self.metal_amp.tick();
            *sample += limit(((sub + noise) * dry + tail * wash + metal) * self.velocity * LEVEL);
        }
        self.level() > 1e-5
    }

    fn steal(&mut self) {
        self.sub.amp.set_time(0.002, self.sample_rate);
        self.noise.amp.set_time(0.002, self.sample_rate);
        self.metal_amp.set_time(0.002, self.sample_rate);
    }

    fn level(&self) -> f32 {
        (self.sub.amp.level() + self.noise.amp.level() + self.metal_amp.level()) * self.velocity
    }

    fn is_released(&self) -> bool {
        true
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.sub.reset();
        self.noise.reset();
        self.wash.reset();
        self.metal.reset();
        self.metal_amp.reset();
        self.metal_filter = Svf::default();
        self.velocity = 0.0;
    }
}
