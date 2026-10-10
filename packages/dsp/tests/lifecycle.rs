// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Slot lifecycle: `Pending` takes no events, retiring lets the tail finish, `collect`
//! frees and the index is reused; a kept slot keeps its filter state across a
//! parameter change (no restart, no click).

mod common;

use common::{HIT, engine, largest_step, live_slot, play, ramp, render, render_slot};
use untzel_dsp::abi::NO_SLOT;
use untzel_dsp::instruments::bass;
use untzel_dsp::params::INSTRUMENT_BASE;
use untzel_dsp::slot::{BLOCK, Lifecycle};

#[test]
fn a_pending_slot_ignores_events_before_activation() {
    let mut engine = engine(48_000.0);
    let kick = engine
        .instance_create(common::instrument_id("kick"))
        .unwrap();
    engine.instance_activate(kick, 1_280.0);
    play(&mut engine, kick, 0.0, HIT, 1_000.0);
    play(&mut engine, kick, 1_280.0, HIT, 1_000.0);
    assert_eq!(engine.slot_lifecycle(kick, 0.0), Some(Lifecycle::Pending));
    let signal = render_slot(&mut engine, kick, 0.0, BLOCK * 20);
    assert!(signal[..1_280].iter().all(|&x| x == 0.0));
    assert_ne!(signal[1_280], 0.0);
    assert_eq!(engine.stats().slot(kick as usize).onset_count, 1.0);
}

#[test]
fn voice_frames_add_up_the_sounding_voices_of_every_render() {
    let mut engine = engine(48_000.0);
    let kick = live_slot(&mut engine, "kick");
    let silent = render_slot(&mut engine, kick, 0.0, BLOCK * 4);
    assert!(silent.iter().all(|&x| x == 0.0));
    assert_eq!(engine.stats().slot(kick as usize).voice_frames, 0.0);
    play(&mut engine, kick, BLOCK as f64 * 4.0, HIT, 1_000.0);
    render_slot(&mut engine, kick, BLOCK as f64 * 4.0, BLOCK * 8);
    let stats = engine.stats().slot(kick as usize);
    // One voice from the onset on: exactly the 8 blocks rendered after it.
    assert_eq!(stats.voice_frames, (BLOCK * 8) as f64 * stats.active_voices);
    assert_eq!(stats.active_voices, 1.0);
}

#[test]
fn retiring_finishes_the_tail_then_collect_frees_the_slot() {
    let sample_rate = 48_000.0;
    let mut engine = engine(sample_rate);
    let kick = live_slot(&mut engine, "kick");
    play(&mut engine, kick, 0.0, HIT, 4_800.0);
    engine.instance_retire(kick, 1_280.0);
    play(&mut engine, kick, 2_000.0, HIT, 4_800.0);
    let signal = render_slot(&mut engine, kick, 0.0, BLOCK * 40);
    assert_ne!(signal[1_300], 0.0, "the tail keeps sounding after retire");
    assert_eq!(
        engine.stats().slot(kick as usize).onset_count,
        1.0,
        "no events after retire"
    );
    assert_eq!(engine.collect(), 0, "still sounding");
    render(&mut engine, (BLOCK * 40) as f64, BLOCK * 1_200);
    assert_eq!(engine.slot_lifecycle(kick, 0.0), Some(Lifecycle::Finished));
    assert_eq!(engine.collect(), 1);
    assert!(engine.slot_signal(kick).is_none());
    let reused = engine
        .instance_create(common::instrument_id("hat"))
        .unwrap();
    assert_eq!(reused, kick, "the freed index is reused");
    assert_eq!(engine.stats().slot(reused as usize).onset_count, 0.0);
}

#[test]
fn unknown_instruments_get_no_slot() {
    let mut engine = engine(48_000.0);
    assert_eq!(engine.instance_create(9_999), None);
    assert_eq!(untzel_dsp::abi::untzel_instance_create(9_999), NO_SLOT);
}

#[test]
fn a_kept_slot_does_not_restart_its_filter_on_a_parameter_change() {
    let sample_rate = 48_000.0;
    let mut engine = engine(sample_rate);
    let bass = live_slot(&mut engine, "bass");
    engine.param_set(bass, (INSTRUMENT_BASE + bass::DECAY) as u32, 2.0);
    play(&mut engine, bass, 0.0, 36.0, 48_000.0);
    // A new program keeps the slot and moves cutoff with the 20 ms ramp, mid-note.
    let change = 12_000;
    let cutoff = (INSTRUMENT_BASE + bass::CUTOFF) as u32;
    let ramp_frames = engine.ramp_frames();
    ramp(
        &mut engine,
        bass,
        cutoff,
        change as f64,
        3_000.0,
        ramp_frames,
    );
    let signal = render_slot(&mut engine, bass, 0.0, BLOCK * 200);
    let before = largest_step(&signal, change - 2_400..change);
    let across = largest_step(&signal, change - 8..change + 8);
    assert!(
        across <= before * 1.5,
        "step {across} at the change, {before} before"
    );
}
