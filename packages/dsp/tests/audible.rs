// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! `audible` (general index 9): the silence of a soloed-out slot comes after the
//! parameter chain, so it holds whatever drives `gain`, and it fades in the 20 ms ramp.

mod common;

use common::{engine, largest_step, live_slot, play, ramp, render};
use untzel_dsp::params::{AUDIBLE, GAIN};

const RATE: f32 = 48_000.0;
const RAMP: u32 = 960;
const SILENCE_AT: usize = 12_000;
const FRAMES: usize = 48_000;

#[test]
fn an_inaudible_slot_is_silent_while_a_fast_lfo_drives_its_gain() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "pad");
    // gain: sine LFO between 0.2 and 0.8, a quarter of a second per period.
    assert!(engine.modulator_set(slot, GAIN as u32, 0, 0, 12_000.0, 0.0, 0.2, 0.8));
    play(&mut engine, slot, 0.0, 57.0, FRAMES as f64);
    ramp(
        &mut engine,
        slot,
        AUDIBLE as u32,
        SILENCE_AT as f64,
        0.0,
        RAMP,
    );
    let out = render(&mut engine, 0.0, FRAMES);
    // The master delays the whole mix by its limiter lookahead.
    let begin = SILENCE_AT + engine.latency_frames();
    let after = begin + RAMP as usize;
    assert!(
        out.left[..begin].iter().any(|x| x.abs() > 1e-3),
        "the pad sounds before"
    );
    assert!(
        out.left[after..]
            .iter()
            .chain(&out.right[after..])
            .all(|&x| x == 0.0),
        "silent after the ramp"
    );
    let fade = largest_step(&out.left, begin..after);
    let playing = largest_step(&out.left, begin - RAMP as usize..begin);
    assert!(
        fade <= playing * 1.05,
        "no click: fade step {fade}, playing step {playing}"
    );
}

#[test]
fn audible_is_not_a_modulation_target() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "pad");
    assert!(!engine.modulator_set(slot, AUDIBLE as u32, 0, 0, 12_000.0, 0.0, 0.0, 1.0));
    assert!(!engine.envelope_set(slot, AUDIBLE as u32, 0, 0.05, 1.0, 0.0));
}
