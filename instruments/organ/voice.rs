// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Voice of `organ`: nine drawbar partials (sub-octave, fifth, unison, octave and the
//! upper harmonics) grouped as `low`, `mid` and `high`, a decaying percussion partial
//! and a key click, with a light rotating-speaker vibrato.

use crate::engines::additive::{AdditiveControls, AdditiveCore, AdditivePatch, Partial};
use crate::engines::env::AdsrTimes;
use crate::voice::{Params, Voice};

const fn bar(ratio: f32, group: usize, level: f32) -> Partial {
    Partial { ratio, group, level }
}

const EMPTY: Partial = bar(1.0, 0, 0.0);

const PATCH: AdditivePatch = AdditivePatch {
    partials: [
        bar(0.5, 0, 0.8),
        bar(1.5, 0, 0.5),
        bar(1.0, 1, 1.0),
        bar(2.0, 1, 0.7),
        bar(3.0, 2, 0.5),
        bar(4.0, 2, 0.45),
        bar(5.0, 2, 0.3),
        bar(6.0, 2, 0.3),
        bar(8.0, 2, 0.25),
        EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    ],
    count: 9,
    percussion_ratio: 3.0,
    percussion_decay: 0.25,
    click: 0.25,
    vibrato_cents: 6.0,
    level: 0.2643,
};

fn controls(params: &Params) -> AdditiveControls {
    AdditiveControls {
        low: params.at(super::LOW, 0),
        mid: params.at(super::MID, 0),
        high: params.at(super::HIGH, 0),
        percussion: params.at(super::PERCUSSION, 0),
        times: AdsrTimes { attack: params.at(super::ATTACK, 0), decay: 1.0, sustain: 1.0, release: params.at(super::RELEASE, 0) },
    }
}

pub struct OrganVoice {
    core: AdditiveCore,
}

impl Voice for OrganVoice {
    fn new(sample_rate: f32) -> Self {
        OrganVoice { core: AdditiveCore::new(sample_rate, PATCH) }
    }

    fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, params: &Params) {
        self.core.trigger(note, velocity, duration_frames, &controls(params));
    }

    fn render(&mut self, out: &mut [f32], params: &Params) -> bool {
        self.core.render(out, &controls(params))
    }

    fn steal(&mut self) {
        self.core.steal();
    }

    fn level(&self) -> f32 {
        self.core.level()
    }

    fn is_released(&self) -> bool {
        self.core.is_released()
    }
}
