// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `piano`: modal synthesis with a hammer contact. Partials follow the stiff-string inharmonicity
//! `f_k = k f0 sqrt(1 + B k²)` with `B` interpolated by register; the first eight
//! partials have a detuned twin for the beating of double and triple strings; the
//! hammer is a short contact (0.3 to 3 ms, shorter when hard) whose spectrum is put on
//! each partial, plus the thump of the felt (`noise`); partial amplitudes fall as
//! `1/k^p`, `p` set by `hardness`; decay times shorten with the partial number;
//! at the end of the note the damper drops every mode to `release` (except above g6);
//! a fixed body filter sits after the sum.

use crate::engines::limit;
use crate::engines::modal::{Exciter, ModalBank, Mode, shape_contact};
use crate::engines::played_note;
use crate::math::{Svf, filter_gain, midi_to_hz};
use crate::engines::env::AdsrTimes;
use crate::engines::sampler::{Recorded, SamplePack, SamplerControls, SamplerPatch};
use crate::voice::{Params, Voice};

const MODES: usize = 56;
/// Inharmonicity `B` at midi 21, 33, 45, 57, 69, 81, 93, 108.
const INHARMONICITY: [(f32, f32); 8] = [
    // Measured values of real grand pianos (about 0.0004 at C4); the earlier table was
    // 4 to 5 times higher and put the 8th partial of C4 a semitone sharp (toy piano).
    (21.0, 0.0003),
    (33.0, 0.0003),
    (45.0, 0.0003),
    (57.0, 0.0004),
    (69.0, 0.0007),
    (81.0, 0.0015),
    (93.0, 0.004),
    (108.0, 0.012),
];
/// Above this note there is no damper (the top of a real piano).
const UNDAMPED_FROM: f32 = 91.0;
const PARTIAL_CEILING_HZ: f32 = 12_000.0;
const LEVEL: f32 = 0.112;
/// A hard contact rings every partial at full level: this many dB per unit of `hardness`
/// above 0.5 come off, so `bright` is brighter, not louder. Fitted on
/// pnpm sim --levels.
const HARDNESS_LEVEL_DB: f32 = 24.0;
/// A very soft felt rings little: this many dB per unit of `hardness` below 0.5 come back.
const SOFTNESS_LEVEL_DB: f32 = 6.0;

/// `B` for a midi note, piecewise linear between the table points.
pub fn inharmonicity(note: f32) -> f32 {
    let first = INHARMONICITY[0];
    if note <= first.0 {
        return first.1;
    }
    for pair in INHARMONICITY.windows(2) {
        let (a, b) = (pair[0], pair[1]);
        if note <= b.0 {
            return a.1 + (b.1 - a.1) * (note - a.0) / (b.0 - a.0);
        }
    }
    INHARMONICITY[7].1
}

/// Frequency of partial `k` (1-based) of a note with fundamental `f0`.
pub fn partial_hz(f0: f32, k: usize, b: f32) -> f32 {
    let k = k as f32;
    k * f0 * (1.0 + b * k * k).sqrt()
}

pub struct PianoVoice {
    /// The recorded instrument, when `source` is `samples` and the pack is there.
    recorded: Recorded,
    /// LEVEL with the hardness correction of the last strike.
    strike_level: f32,
    sample_rate: f32,
    bank: ModalBank<MODES>,
    body_low: Svf,
    body_high: Svf,
    note: f32,
    gate_left: u32,
    damped: bool,
    peak: f32,
}

impl PianoVoice {
    fn synth_steal(&mut self) {
        self.bank.steal();
    }
    fn modes(&self, note: f32, params: &Params, out: &mut [Mode; MODES]) -> usize {
        let f0 = midi_to_hz(note);
        let b = inharmonicity(note);
        let hardness = params.at(super::HARDNESS, 0);
        let brightness = params.at(super::BRIGHTNESS, 0);
        let decay = params.at(super::DECAY, 0);
        let detune = params.at(super::DETUNE, 0);
        // Register: low notes ring longer and carry more partials.
        let register = ((note - 21.0) / 87.0).clamp(0.0, 1.0);
        // 36 partials in the bass (the contact keeps them all audible, so the count is the cost).
        let max_partials = (36.0 - 18.0 * register) as usize;
        let t0 = decay * (1.6 - 1.2 * register);
        let exponent = 0.95 - 0.6 * hardness;
        // Up to a third of a semitone at full `detune` (the saloon piano of `honky`).
        let cents = (1.5 - 0.9 * register) * (0.3 + 1.7 * detune) + 14.0 * detune * detune * detune;
        // `body` also lifts the second partial (the short, boxy upright).
        let second = 1.0 + 1.6 * (params.at(super::BODY, 0) - 0.5).max(0.0);
        let twin = (cents / 1200.0 * core::f32::consts::LN_2).exp();
        let mut count = 0;
        for k in 1..=max_partials {
            let hz = partial_hz(f0, k, b);
            if hz > PARTIAL_CEILING_HZ.min(0.45 * self.sample_rate) || count >= MODES {
                break;
            }
            let roll = if k == 2 { second } else { 1.0 } / (k as f32).powf(exponent);
            let tilt = 1.0 + brightness * (k as f32 / 5.0).min(2.0);
            let mode_decay = t0 / (1.0 + 0.15 * (k as f32 - 1.0));
            out[count] = Mode { hz, gain: roll * tilt, decay: mode_decay };
            count += 1;
            if k <= 8 && count < MODES {
                out[count] = Mode { hz: hz * twin, gain: roll * tilt * 0.7, decay: mode_decay * 1.4 };
                count += 1;
            }
        }
        count
    }
}


/// The recorded pack's voice; level fitted on pnpm sim --levels.
const RECORDED: SamplerPatch = SamplerPatch { vibrato: 0.0, vibrato_hz: 0.0, stem_detune_cents: 0.0, level: 0.544 };
/// Index of `samples` in the choices of `source`.
const SAMPLES: usize = 1;

fn recorded_controls(params: &Params) -> SamplerControls {
    SamplerControls {
        vowel: 0.0,
        gain: params.at(super::LEVEL, 0),
        brightness: params.at(super::BRIGHTNESS, 0),
        detune: 0.0,
        times: AdsrTimes { attack: 0.001, decay: params.at(super::DECAY, 0), sustain: 0.0, release: params.at(super::RELEASE, 0) },
    }
}

impl PianoVoice {
    fn synth_render(&mut self, out: &mut [f32], params: &Params) -> bool {
        if self.gate_left > 0 {
            self.gate_left = self.gate_left.saturating_sub(out.len() as u32);
            if self.gate_left == 0 && !self.damped && self.note < UNDAMPED_FROM {
                self.bank.damp(params.at(super::RELEASE, 0));
                self.damped = true;
            }
        }
        let start = out.len();
        let mut voice = [0.0_f32; 128];
        let len = start.min(voice.len());
        let sounding = self.bank.render(&mut voice[..len], self.strike_level);
        let body = params.at(super::BODY, 0);
        let low_g = filter_gain(120.0, self.sample_rate);
        let high_g = filter_gain(2_500.0, self.sample_rate);
        let mut peak = 0.0_f32;
        for (sample, &x) in out.iter_mut().zip(&voice[..len]) {
            let low = self.body_low.process(x, low_g, 1.4).band;
            let high = self.body_high.process(x, high_g, 1.0).band;
            let y = x + body * (0.8 * low + 0.5 * high);
            peak = peak.max(y.abs());
            *sample += limit(y);
        }
        self.peak = peak;
        sounding
    }
}

impl Voice for PianoVoice {
    fn new(sample_rate: f32) -> Self {
        PianoVoice {
            recorded: Recorded::new(sample_rate, RECORDED),
            strike_level: LEVEL,
            sample_rate,
            bank: ModalBank::new(sample_rate, 0x7069_616e),
            body_low: Svf::default(),
            body_high: Svf::default(),
            note: 60.0,
            gate_left: 0,
            damped: false,
            peak: 0.0,
        }
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        let synth = self.synth_render(out, params);
        let recorded = self.recorded.render(out, &recorded_controls(params));
        synth || recorded
    }
    fn render_mid_side(&mut self, mid: &mut [f32], side: &mut [f32], params: &Params) -> bool {
        let synth = self.synth_render(mid, params);
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
        if self.recorded.trigger(wanted, if params.at(super::HARDNESS, 0) >= 0.4 && velocity >= 0.79 { 1.0 } else { 0.0 }, note, velocity, duration_frames, &recorded_controls(params)) {
            self.synth_steal();
            return;
        }
        self.note = played_note(note);
        let mut modes = [Mode::default(); MODES];
        let count = self.modes(self.note, params, &mut modes);
        let hardness = params.at(super::HARDNESS, 0);
        let soft = 1.0 - hardness * velocity;
        let contact = 0.0003 + 0.0027 * soft * soft;
        shape_contact(&mut modes[..count], midi_to_hz(self.note), contact, hardness);
        let hammer = Exciter::Contact { seconds: contact.max(0.0003), noise: params.at(super::NOISE, 0) };
        let level_db = SOFTNESS_LEVEL_DB * (0.5 - hardness).max(0.0) - HARDNESS_LEVEL_DB * (hardness - 0.5).max(0.0);
        self.strike_level = LEVEL * (level_db * (core::f32::consts::LN_10 / 20.0)).exp();
        self.bank.strike(&modes[..count], hammer, velocity, 0.25 + 0.75 * hardness);
        self.gate_left = duration_frames.max(1);
        self.damped = false;
    }



    fn level(&self) -> f32 {
        (self.peak).max(self.recorded.level())
    }

    fn is_released(&self) -> bool {
        if self.recorded.is_sampled() { self.recorded.is_released() } else { self.gate_left == 0 }
    }

    fn reset(&mut self, _sample_rate: f32) {
        self.recorded.reset();
        self.bank.reset();
        self.body_low = Svf::default();
        self.body_high = Svf::default();
        self.gate_left = 0;
        self.peak = 0.0;
    }
}
