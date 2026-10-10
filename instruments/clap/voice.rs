// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `clap`: band-passed noise in four quick bursts (the hands), then a tail.
//! `spread` widens the gap between bursts, `color` moves the band up, `decay` is the
//! tail. Parameter indices: `super::<NAME>` (generated from manifest.json).

//! Recorded (VCSL CC0): `spread` crossfades one pair of hands into a group clap.
use crate::engines::limit;
use crate::engines::percussion::{Bursts, FilteredNoise, NoiseShape};
use crate::engines::sampler::{Hit, RecordedHit, SamplePack};
use crate::voice::{Params, Voice};

const BURSTS: u32 = 4;
const LEVEL: f32 = 0.9791;

/// The recording's level, fitted on pnpm sim --levels against the synthesis.
const RECORDED_LEVEL: f32 = 0.89;
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;
pub struct ClapVoice {
    /// The recorded hit, when `source` is `samples` and the pack is there.
    recorded: RecordedHit,
    sample_rate: f32,
    bursts: Bursts,
    noise: FilteredNoise,
    velocity: f32,
}

impl ClapVoice {
    fn render_synth(&mut self, out: &mut [f32], params: &Params) -> bool {
        if self.bursts.is_done() {
            return false;
        }
        self.bursts.set_tail(params.at(super::DECAY, 0));
        let center = 900.0 + 2_400.0 * params.at(super::COLOR, 0);
        for sample in out.iter_mut() {
            let envelope = self.bursts.tick();
            let noise = self.noise.next(NoiseShape::Band, center, 0.9, 1.0, self.sample_rate);
            *sample += limit(noise * envelope * self.velocity * LEVEL);
        }
        !self.bursts.is_done()
    }
}
impl Voice for ClapVoice {
    fn new(sample_rate: f32) -> Self {
        ClapVoice { recorded: RecordedHit::new(sample_rate, RECORDED_LEVEL), sample_rate, bursts: Bursts::default(), noise: FilteredNoise::new(0x636c_6170), velocity: 0.0 }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        let hit = Hit { position: params.at(super::SPREAD, 0), note: 60.0, velocity, decay: params.at(super::DECAY, 0) + 0.05, brightness: 0.35 + 0.3 * params.at(super::COLOR, 0) };
        if self.recorded.trigger(params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES, hit, duration_frames) {
            self.bursts.reset();
            return;
        }
        let spacing = 0.006 + 0.012 * params.at(super::SPREAD, 0);
        self.bursts.trigger(BURSTS, spacing, params.at(super::DECAY, 0), 1.0, self.sample_rate);
        self.noise.amp.trigger(1.0, 10.0, self.sample_rate);
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
        self.bursts.reset();
    }

    fn level(&self) -> f32 {
        (self.bursts.level() * self.velocity).max(self.recorded.level())
    }

    fn is_released(&self) -> bool {
        true
    }
}
