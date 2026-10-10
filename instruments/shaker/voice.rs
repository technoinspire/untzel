// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `shaker`: high-passed noise with a soft attack, like grains hitting a
//! shell. `color` brightens it, `spread` lengthens the attack, `decay` the tail.

//! Recorded (VCSL CC0): `color` crossfades the low, soft stroke into the high, crisp one.
use crate::engines::limit;
use crate::engines::percussion::{FilteredNoise, NoiseShape};
use crate::engines::sampler::{Hit, RecordedHit, SamplePack};
use crate::voice::{Params, Voice};

const LEVEL: f32 = 0.76;

/// The recording's level, fitted on pnpm sim --levels against the synthesis.
const RECORDED_LEVEL: f32 = 6.7;
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;
pub struct ShakerVoice {
    /// The recorded hit, when `source` is `samples` and the pack is there.
    recorded: RecordedHit,
    sample_rate: f32,
    noise: FilteredNoise,
    attack_left: u32,
    attack_frames: u32,
    velocity: f32,
}

impl ShakerVoice {
    fn render_synth(&mut self, out: &mut [f32], params: &Params) -> bool {
        let cutoff = 3_500.0 + 6_000.0 * params.at(super::COLOR, 0);
        for sample in out.iter_mut() {
            let ramp = if self.attack_left > 0 {
                self.attack_left -= 1;
                1.0 - self.attack_left as f32 / self.attack_frames as f32
            } else {
                1.0
            };
            let noise = self.noise.next(NoiseShape::High, cutoff, 1.0, 1.0, self.sample_rate);
            *sample += limit(noise * ramp * self.velocity * LEVEL);
        }
        self.noise.amp.level() > 1e-5
    }
}
impl Voice for ShakerVoice {
    fn new(sample_rate: f32) -> Self {
        ShakerVoice { recorded: RecordedHit::new(sample_rate, RECORDED_LEVEL), sample_rate, noise: FilteredNoise::new(0x7368_616b), attack_left: 0, attack_frames: 1, velocity: 0.0 }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        let hit = Hit { position: params.at(super::COLOR, 0), note: 60.0, velocity, decay: params.at(super::DECAY, 0), brightness: 0.42 + 0.23 * params.at(super::COLOR, 0) };
        if self.recorded.trigger(params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES, hit, duration_frames) {
            self.velocity = 0.0;
            return;
        }
        self.attack_frames = (((0.002 + 0.012 * params.at(super::SPREAD, 0)) * self.sample_rate) as u32).max(1);
        self.attack_left = self.attack_frames;
        self.noise.amp.trigger(1.0, params.at(super::DECAY, 0) + 0.01, self.sample_rate);
        self.velocity = velocity;
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let recorded = self.recorded.render(out);
        self.render_synth(out, params) || recorded
    }
    fn use_samples(&mut self, pack: Option<&'static SamplePack>) {
        self.recorded.set_pack(pack);
    }

    fn steal(&mut self) {
        self.recorded.steal();
        self.noise.amp.set_time(0.002, self.sample_rate);
    }

    fn level(&self) -> f32 {
        (self.noise.amp.level() * self.velocity).max(self.recorded.level())
    }

    fn is_released(&self) -> bool {
        true
    }
}
