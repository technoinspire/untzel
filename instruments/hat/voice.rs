// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of the `hat` instrument: six inharmonic squares (the 808 ratios) and noise
//! through a high-pass. `open` stretches the decay up to ten times; `color` moves from
//! metallic and dark to noisy and bright. Parameter indices: `super::<NAME>`
//! (generated from manifest.json by packages/dsp/build.rs).

//! Recorded (VCSL CC0): `open` crossfades the closed hat into the open one and stretches its decay; `tight` and `metal` stay synthesised (presets).
use crate::math::{Noise, SILENCE, Svf, advance_phase, decay_coefficient, filter_gain};
use crate::engines::sampler::{Hit, RecordedHit, SamplePack};
use crate::voice::{Params, Voice};

const METAL_HZ: [f32; 6] = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
const OPEN_STRETCH: f32 = 9.0;
const HIGH_PASS_DARK_HZ: f32 = 5_500.0;
const HIGH_PASS_BRIGHT_HZ: f32 = 10_000.0;
const HIGH_PASS_DAMPING: f32 = 1.2;
const LEVEL: f32 = 0.55;
/// The band-pass is quieter than the high-pass it replaces.
const BAND_GAIN: f32 = 1.6;

/// The recording's level, fitted on pnpm sim --levels against the synthesis.
const RECORDED_LEVEL: f32 = 0.5;
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;
pub struct HatVoice {
    /// The recorded hit, when `source` is `samples` and the pack is there.
    recorded: RecordedHit,
    sample_rate: f32,
    phases: [f32; 6],
    noise: Noise,
    filter: Svf,
    level: f32,
}

impl HatVoice {
    fn render_synth(&mut self, out: &mut [f32], params: &Params) -> bool {
        let open = params.at(super::OPEN, 0);
        let seconds = params.at(super::DECAY, 0) * (1.0 + OPEN_STRETCH * open);
        let decay = decay_coefficient(seconds, self.sample_rate);
        let band = params.at(super::BAND, 0);
        for (n, sample) in out.iter_mut().enumerate() {
            let color = params.at(super::COLOR, n);
            let mut metal = 0.0;
            for (phase, hz) in self.phases.iter_mut().zip(METAL_HZ) {
                *phase = advance_phase(*phase, hz * (1.0 + color) / self.sample_rate);
                metal += if *phase < 0.5 { 1.0 } else { -1.0 };
            }
            let source = (1.0 - color) * metal / 6.0 + color * self.noise.sample();
            let cutoff = HIGH_PASS_DARK_HZ + (HIGH_PASS_BRIGHT_HZ - HIGH_PASS_DARK_HZ) * color;
            let g = filter_gain(cutoff, self.sample_rate);
            let filtered = self.filter.process(source, g, HIGH_PASS_DAMPING);
            // `band` crossfades the high-pass into a band-pass: a thin, boxed hat.
            let high = if band > 0.0 { filtered.high + band * (BAND_GAIN * filtered.band - filtered.high) } else { filtered.high };
            *sample += high * self.level * LEVEL;
            self.level *= decay;
        }
        self.level > SILENCE
    }
}
impl Voice for HatVoice {
    fn new(sample_rate: f32) -> Self {
        HatVoice { recorded: RecordedHit::new(sample_rate, RECORDED_LEVEL), sample_rate,
            phases: [0.0, 0.17, 0.41, 0.63, 0.29, 0.85],
            noise: Noise::new(0x6861_7421),
            filter: Svf::default(),
            level: 0.0,
        }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        let hit = Hit { position: params.at(super::OPEN, 0), note: 60.0, velocity, decay: params.at(super::DECAY, 0) * (1.0 + OPEN_STRETCH * params.at(super::OPEN, 0)), brightness: 0.35 + 0.3 * params.at(super::COLOR, 0) };
        if self.recorded.trigger(params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES, hit, duration_frames) {
            self.level = 0.0;
            return;
        }
        self.level = velocity;
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
    }
    fn level(&self) -> f32 {
        self.level.max(self.recorded.level())
    }
}
