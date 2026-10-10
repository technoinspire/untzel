// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `strings`: five saws or pulses in a fan, an ensemble of bowed strings. A
//! `width` below 0.45 switches to pulses (thinner), below 0.3 it also bows a tremolo.
//! `ensemble` sends the fan through a three-phase stereo ensemble,
//! `vibrato` is delayed by 0.3 s, and `body` adds the resonances of a wooden body.
//! Parameter indices: `super::<NAME>` (generated from manifest.json).

use crate::engines::ensemble::Ensemble;
use crate::engines::env::AdsrTimes;
use crate::engines::limit;
use crate::engines::va::{VaControls, VaCore, VaPatch, VaShape, VaShapeParams, Wave};
use crate::math::{Svf, filter_gain};
use crate::engines::sampler::{Recorded, SamplePack, SamplerControls, SamplerPatch};
use crate::voice::{MAX_RENDER_FRAMES, Params, Voice};

/// Body resonances of a bowed instrument: the air and the top plate.
const BODY_HZ: [f32; 2] = [280.0, 2_800.0];
const BODY_GAINS: [f32; 2] = [1.2, 0.8];

const PATCH: VaPatch = VaPatch {
    oscillators: 5,
    detune_spread: 0.22,
    envelope_octaves: 0.3,
    envelope_decay: 2.0,
    key_tracking: 0.4,
    level: 0.212,
    // Analog wander and voice cards.
    drift_cents: 6.0,
    card_cents: 3.0,
    card_cutoff_octaves: 0.1,
    ..VaPatch::DEFAULT
};

/// Brightness 0..1 to a cutoff of 150 Hz .. 19 kHz.
fn brightness_cutoff(brightness: f32) -> f32 {
    150.0 * (7.0 * brightness.clamp(0.0, 1.0)).exp2()
}

/// The sound-design parameters this instrument exposes.
const SHAPE: VaShapeParams = VaShapeParams {
    wave2: Some(super::WAVE2),
    mix: Some(super::MIX),
    sync: Some(super::SYNC),
    filter: Some(super::FILTER),
    filter_attack: Some(super::FILTER_ATTACK),
    filter_decay: Some(super::FILTER_DECAY),
    drive: Some(super::DRIVE),
    spread: Some(super::SPREAD),
    sub: Some(super::SUB),
    noise: Some(super::NOISE),
    vibrato: Some(super::VIBRATO),
    ..VaShapeParams::NONE
};

fn controls(params: &Params) -> VaControls {
    let width = params.at(super::WIDTH, 0);
    VaControls {
        cutoff: brightness_cutoff(params.at(super::BRIGHTNESS, 0) * 0.9 + 0.05),
        cutoff_step: 0.0,
        resonance: 0.1,
        detune: params.at(super::DETUNE, 0),
        wave: if width < 0.45 { Wave::Square } else { Wave::Saw },
        width: 0.2 + 0.6 * width,
        times: AdsrTimes { attack: params.at(super::ATTACK, 0), decay: 2.0, sustain: 0.9, release: params.at(super::RELEASE, 0) },
        contour: 0.2,
        accent: 0.0,
        tremolo: (0.3 - width).max(0.0) * 2.0,
        // The pulses measure 6 to 11 dB above the saws (pnpm sim --levels).
        gain: params.at(super::LEVEL, 0) * if width < 0.45 { 0.28 + 0.45 * width } else { 1.0 },
        shape: SHAPE.read(params, VaShape::NEUTRAL),
    }
}

pub struct StringsVoice {
    /// The recorded instrument, when `source` is `samples` and the pack is there.
    recorded: Recorded,
    sample_rate: f32,
    core: VaCore,
    ensemble: Ensemble,
    body: [Svf; 2],
}

impl StringsVoice {
    fn synth_steal(&mut self) {
        self.core.steal();
    }
    /// The fan through the body and the ensemble (only when one of them is on).
    fn render_shaped(&mut self, out: &mut [f32], side: &mut [f32], params: &Params, controls: &VaControls) -> bool {
        let amount = params.at(super::ENSEMBLE, 0);
        let body = params.at(super::BODY, 0);
        let len = out.len().min(MAX_RENDER_FRAMES);
        let (mut mid, mut wide) = ([0.0_f32; MAX_RENDER_FRAMES], [0.0_f32; MAX_RENDER_FRAMES]);
        let sounding = self.core.render_mid_side(&mut mid[..len], Some(&mut wide[..len]), controls);
        let gains = BODY_HZ.map(|hz| filter_gain(hz, self.sample_rate));
        let mut shaped = [0.0_f32; MAX_RENDER_FRAMES];
        for (y, &x) in shaped[..len].iter_mut().zip(&mid[..len]) {
            let air = self.body[0].process(x, gains[0], 1.0).band;
            let plate = self.body[1].process(x, gains[1], 1.2).band;
            *y = x * (1.0 - 0.4 * body) + body * (BODY_GAINS[0] * air + BODY_GAINS[1] * plate);
        }
        let (mut wet_mid, mut wet_side) = ([0.0_f32; MAX_RENDER_FRAMES], [0.0_f32; MAX_RENDER_FRAMES]);
        self.ensemble.process_block(&shaped[..len], amount, &mut wet_mid[..len], &mut wet_side[..len]);
        for n in 0..len {
            out[n] += limit(wet_mid[n]);
            side[n] += limit(wide[n] + wet_side[n]);
        }
        sounding
    }
}


/// The recorded pack's voice; level fitted on pnpm sim --levels.
const RECORDED: SamplerPatch = SamplerPatch { vibrato: 0.0, vibrato_hz: 0.0, stem_detune_cents: 0.0, level: 0.485 };
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;

fn recorded_controls(params: &Params) -> SamplerControls {
    SamplerControls {
        vowel: 0.0,
        gain: 1.0,
        brightness: 0.5 + 0.6 * (params.at(super::BRIGHTNESS, 0) - 0.5),
        detune: 0.0,
        times: AdsrTimes { attack: params.at(super::ATTACK, 0), decay: 1.0, sustain: 1.0, release: params.at(super::RELEASE, 0) },
    }
}

impl StringsVoice {
    fn synth_mid_side(&mut self, out: &mut [f32], side: &mut [f32], params: &Params) -> bool {
        let controls = controls(params);
        if params.at(super::ENSEMBLE, 0) <= 0.0 && params.at(super::BODY, 0) <= 0.0 {
            return self.core.render_mid_side(out, Some(side), &controls);
        }
        self.render_shaped(out, side, params, &controls)
    }
}

impl Voice for StringsVoice {
    fn new(sample_rate: f32) -> Self {
        StringsVoice {
            recorded: Recorded::new(sample_rate, RECORDED), sample_rate, core: VaCore::new(sample_rate, PATCH), ensemble: Ensemble::new(sample_rate), body: [Svf::default(); 2] }
    }

    fn render_mid_side(&mut self, mid: &mut [f32], side: &mut [f32], params: &Params) -> bool {
        let synth = self.synth_mid_side(mid, side, params);
        let recorded = self.recorded.render_mid_side(mid, side, &recorded_controls(params));
        synth || recorded
    }
    fn use_samples(&mut self, pack: Option<&'static SamplePack>) {
        self.recorded.set_pack(pack);
    }
    fn steal(&mut self) {
        self.synth_steal();
        self.recorded.steal();
    }
    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        let wanted = params.choice(super::SOURCE, super::SOURCE_CHOICES) == SAMPLES;
        if self.recorded.trigger(wanted, if params.at(super::WIDTH, 0) < 0.15 { 1.0 } else if params.at(super::BRIGHTNESS, 0) >= 0.2 { 0.5 } else { 0.0 }, note, velocity, duration_frames, &recorded_controls(params)) {
            self.synth_steal();
            return;
        }
        self.core.trigger(note, velocity, duration_frames, &controls(params));
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let mut side = [0.0_f32; MAX_RENDER_FRAMES];
        let len = out.len().min(MAX_RENDER_FRAMES);
        self.render_mid_side(&mut out[..len], &mut side[..len], params)
    }



    fn level(&self) -> f32 {
        (self.core.level()).max(self.recorded.level())
    }

    fn is_released(&self) -> bool {
        if self.recorded.is_sampled() { self.recorded.is_released() } else { self.core.is_released() }
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.recorded.reset();
        self.core.reset();
        self.ensemble.reset();
        self.body = [Svf::default(); 2];
    }
}
