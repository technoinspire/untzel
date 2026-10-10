// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! An event at frame `f` starts on exactly that sample: `out[f − 1] == 0` and
//! `out[f] != 0` for a `kick` alone, for every `f` of a block, at 44 100 and 48 000 Hz.
//! The mix carries the same onset shifted by the constant limiter lookahead.

mod common;

use common::{HIT, RATES, engine, live_slot, play, render, render_slot};
use untzel_dsp::slot::BLOCK;
use untzel_dsp::stats::SLOT_CAPACITY;

#[test]
fn a_kick_starts_on_its_exact_frame_in_the_slot_signal() {
    for sample_rate in RATES {
        for f in 0..BLOCK {
            let mut engine = engine(sample_rate);
            let kick = live_slot(&mut engine, "kick");
            let start = (BLOCK * 1_000) as f64;
            play(&mut engine, kick, start + f as f64, HIT, 4_800.0);
            let signal = render_slot(&mut engine, kick, start, 2 * BLOCK);
            if f > 0 {
                assert_eq!(signal[f - 1], 0.0, "{sample_rate} Hz, f = {f}");
            }
            assert!(signal[..f].iter().all(|&x| x == 0.0));
            assert_ne!(signal[f], 0.0, "{sample_rate} Hz, f = {f}");
        }
    }
}

#[test]
fn the_mix_carries_the_onset_after_the_lookahead() {
    for sample_rate in RATES {
        for f in [0, 1, 63, 127] {
            let mut engine = engine(sample_rate);
            let kick = live_slot(&mut engine, "kick");
            play(&mut engine, kick, f as f64, HIT, 4_800.0);
            let out = render(&mut engine, 0.0, 2 * BLOCK);
            let onset = f + engine.latency_frames();
            assert!(out.left[..onset].iter().all(|&x| x == 0.0), "f = {f}");
            assert_ne!(out.left[onset], 0.0, "f = {f}");
            assert_eq!(out.left[onset], out.right[onset], "centred");
        }
    }
}

#[test]
fn stats_record_the_onset_frame_and_count() {
    let mut engine = engine(48_000.0);
    let kick = live_slot(&mut engine, "kick");
    for beat in 0..4 {
        play(
            &mut engine,
            kick,
            1_000.0 + 21_818.0 * beat as f64,
            HIT,
            4_800.0,
        );
    }
    render(&mut engine, 0.0, 128 * 700);
    let stats = engine.stats();
    assert_eq!(stats.get(SLOT_CAPACITY), 1.0);
    let record = stats.slot(kick as usize);
    assert_eq!(record.onset_count, 4.0);
    assert_eq!(record.last_onset_frame, 1_000.0 + 21_818.0 * 3.0);
}

#[test]
fn a_late_event_plays_at_the_block_start_or_drops() {
    let mut engine = engine(48_000.0);
    let kick = live_slot(&mut engine, "kick");
    render(&mut engine, 0.0, BLOCK * 10);
    let block_start = (BLOCK * 10) as f64;
    play(&mut engine, kick, block_start - 100.0, HIT, 4_800.0);
    play(&mut engine, kick, block_start - 500.0, HIT, 4_800.0);
    let signal = render_slot(&mut engine, kick, block_start, BLOCK);
    assert_ne!(signal[0], 0.0, "100 frames late: plays at the block start");
    let stats = engine.stats();
    assert_eq!(stats.get(untzel_dsp::stats::LATE_DROPS), 1.0);
    assert_eq!(stats.slot(kick as usize).onset_count, 1.0);
    assert_eq!(stats.slot(kick as usize).last_onset_frame, block_start);
}
