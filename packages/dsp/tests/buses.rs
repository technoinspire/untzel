// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Shared buses: `untzel_tempo` changes the delay time; switching reverb space or delay
//! division crossfades without a step; an unused bus costs nothing; full queues answer 1.

mod common;

use common::{HIT, engine, largest_step, live_slot, play, render};
use untzel_dsp::abi::{
    PUSH_OK, PUSH_QUEUE_FULL, untzel_engine_new, untzel_event_push, untzel_instance_create,
    untzel_param_push, untzel_stats_len,
};
use untzel_dsp::engine::{EVENT_CAPACITY, Engine, POINT_CAPACITY};
use untzel_dsp::instruments::bass;
use untzel_dsp::params::{DELAY_DIVISION, DELAY_SEND, INSTRUMENT_BASE, REVERB_SEND, REVERB_SPACE};
use untzel_dsp::slot::BLOCK;
use untzel_dsp::stats::QUEUE_DROPS;

/// Frame of the first echo of a single hat hit through the `1/4` delay at `bpm`.
fn quarter_echo_frame(bpm: f64) -> usize {
    let sample_rate = 48_000.0;
    let mut engine = engine(sample_rate);
    let hat = live_slot(&mut engine, "hat");
    engine.param_set(hat, DELAY_SEND as u32, 1.0);
    engine.param_set(hat, DELAY_DIVISION as u32, 2.0);
    engine.tempo(bpm, 0.0);
    play(&mut engine, hat, 0.0, HIT, 100.0);
    let out = render(&mut engine, 0.0, BLOCK * 900);
    // The dry hit is gone after 0.2 s; the loudest later sample is the echo onset.
    let dry_end = 9_600;
    let peak = out.left[dry_end..]
        .iter()
        .fold(0.0_f32, |max, x| max.max(x.abs()));
    dry_end
        + out.left[dry_end..]
            .iter()
            .position(|x| x.abs() > peak * 0.5)
            .unwrap()
}

#[test]
fn the_delay_follows_untzel_tempo() {
    let at_120 = quarter_echo_frame(120.0);
    let at_60 = quarter_echo_frame(60.0);
    // 1/4 is 0.5 s at 120 bpm and 1 s at 60 bpm.
    assert!((at_120 as i64 - 24_000).abs() < 400, "{at_120}");
    assert!((at_60 as i64 - 48_000).abs() < 400, "{at_60}");
}

fn steady_bass_through(engine: &mut Engine, param: usize, send: usize) -> u32 {
    let bass = live_slot(engine, "bass");
    engine.param_set(bass, send as u32, 1.0);
    engine.param_set(bass, param as u32, 0.0);
    engine.param_set(bass, (INSTRUMENT_BASE + bass::DECAY) as u32, 2.0);
    play(engine, bass, 0.0, 36.0, 200_000.0);
    bass
}

fn switch_is_smooth(param: usize, send: usize) {
    let mut engine = engine(48_000.0);
    let bass = steady_bass_through(&mut engine, param, send);
    let switch = 24_000;
    common::ramp(&mut engine, bass, param as u32, switch as f64, 2.0, 0);
    let out = render(&mut engine, 0.0, BLOCK * 400);
    let latency = engine.latency_frames();
    let around = switch + latency;
    let before = largest_step(&out.left, around - 4_800..around);
    let across = largest_step(&out.left, around - 16..around + 960);
    assert!(
        across <= before * 1.5,
        "param {param}: {across} vs {before}"
    );
}

#[test]
fn switching_reverb_space_has_no_step() {
    switch_is_smooth(REVERB_SPACE, REVERB_SEND);
}

#[test]
fn switching_delay_division_has_no_step() {
    switch_is_smooth(DELAY_DIVISION, DELAY_SEND);
}

#[test]
fn full_queues_answer_one_and_count_drops() {
    assert_eq!(untzel_engine_new(48_000.0), 0);
    assert_eq!(untzel_engine_new(48_000.0), 1, "already created");
    let slot = untzel_instance_create(common::instrument_id("kick"));
    assert_eq!(untzel_stats_len(), 10);
    for n in 0..EVENT_CAPACITY {
        assert_eq!(untzel_event_push(slot, n as f64, 10.0, -1.0, 1.0), PUSH_OK);
    }
    assert_eq!(
        untzel_event_push(slot, 0.0, 10.0, -1.0, 1.0),
        PUSH_QUEUE_FULL
    );
    for n in 0..POINT_CAPACITY {
        assert_eq!(untzel_param_push(slot, 0, n as f64, 0.5, 0), PUSH_OK);
    }
    assert_eq!(untzel_param_push(slot, 0, 0.0, 0.5, 0), PUSH_QUEUE_FULL);
    let drops = untzel_dsp::abi::with_engine_for_tests(|engine| engine.stats().get(QUEUE_DROPS));
    assert_eq!(drops, Some(2.0));
}

#[test]
fn invalid_sample_rates_are_rejected() {
    assert_eq!(untzel_engine_new(f32::NAN), 1);
    assert_eq!(untzel_engine_new(0.0), 1);
    assert!(Engine::new(1e9).is_none());
}
