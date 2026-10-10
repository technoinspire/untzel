// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `cowbell`: two strong modes a fifth-and-a-bit apart (with their first
//! overtones) struck by a short noise burst, then a band-pass that gives the hollow
//! bell; a brief metal click on the attack. `tune` moves the bell, `decay` its ring.

//! Recorded (VCSL CC0): one bell, `tune` a semitone scale around it.
use crate::engines::env::Decay;
use crate::engines::limit;
use crate::engines::modal::{Exciter, ModalBank, Mode};
use crate::engines::percussion::Metal;
use crate::math::{Svf, filter_gain};
use crate::engines::sampler::{Hit, RecordedHit, SamplePack};
use crate::voice::{Params, Voice};

const LEVEL: f32 = 0.1696;
const SECOND_RATIO: f32 = 1.48;

/// The recording's level, fitted on pnpm sim --levels against the synthesis.
const RECORDED_LEVEL: f32 = 0.89;
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;
pub struct CowbellVoice {
    /// The recorded hit, when `source` is `samples` and the pack is there.
    recorded: RecordedHit,
    sample_rate: f32,
    bank: ModalBank<4>,
    band: Svf,
    click: Decay,
    metal: Metal,
    hz: f32,
    scratch: [f32; 128],
}

impl CowbellVoice {
    fn render_synth(&mut self, out: &mut [f32], _params: &Params) -> bool {
        let len = out.len().min(self.scratch.len());
        let scratch = &mut self.scratch[..len];
        scratch.fill(0.0);
        let sounding = self.bank.render(scratch, 1.0);
        let g = filter_gain(self.hz * 1.6, self.sample_rate);
        for (sample, &x) in out.iter_mut().zip(scratch.iter()) {
            let click = self.click.tick() * self.metal.next(self.hz * 2.0, self.sample_rate);
            let banded = self.band.process(x + click, g, 0.9).band;
            *sample += limit((banded + 0.4 * x) * LEVEL);
        }
        sounding
    }
}
impl Voice for CowbellVoice {
    fn new(sample_rate: f32) -> Self {
        CowbellVoice { recorded: RecordedHit::new(sample_rate, RECORDED_LEVEL), sample_rate,
            bank: ModalBank::new(sample_rate, 0x636f_7762),
            band: Svf::default(),
            click: Decay::default(),
            metal: Metal::default(),
            hz: 540.0,
            scratch: [0.0; 128],
        }
    }

    fn trigger(&mut self, _note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        let hit = Hit { position: 0.0, note: 72.0 + 12.0 * (params.at(super::TUNE, 0) - 0.5), velocity, decay: params.at(super::DECAY, 0), brightness: 0.5 };
        if self.recorded.trigger(params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES, hit, duration_frames) {
            self.bank.steal();
            return;
        }
        self.hz = 520.0 * (1.2 * params.at(super::TUNE, 0) - 0.4).exp2();
        let decay = params.at(super::DECAY, 0);
        let modes = [
            Mode { hz: self.hz, gain: 1.0, decay },
            Mode { hz: self.hz * SECOND_RATIO, gain: 0.8, decay: decay * 0.8 },
            Mode { hz: self.hz * 2.02, gain: 0.25, decay: decay * 0.4 },
            Mode { hz: self.hz * SECOND_RATIO * 2.03, gain: 0.2, decay: decay * 0.3 },
        ];
        self.bank.strike(&modes, Exciter::Noise(0.002), velocity, 1.0);
        self.click.trigger(0.25 * velocity, 0.01, self.sample_rate);
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
        self.bank.steal();
    }

    fn level(&self) -> f32 {
        (self.bank.peak()).max(self.recorded.level())
    }

    fn is_released(&self) -> bool {
        true
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.recorded.reset();
        self.bank.reset();
        self.band = Svf::default();
        self.click.reset();
    }
}
