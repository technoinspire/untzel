// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Insert chain and fast modulators through the engine.

mod common;

use common::{EVERY_EFFECT, HIT, engine, insert_chain, largest_step, live_slot, play, render};
use untzel_dsp::engine::Engine;
use untzel_dsp::params::{EFFECT_BASE, GAIN, INSTRUMENT_BASE};
use untzel_dsp::slot::{BLOCK, Lifecycle};
use untzel_dsp::stats::NAN_RESETS;

const RATE: f32 = 48_000.0;
const SECOND: usize = 48_000 - 48_000 % BLOCK;

fn groove(engine: &mut Engine, slot: u32, seconds: f64) {
    let step = 6_000.0;
    let mut frame = 0.0;
    let mut n = 0;
    while frame < seconds * f64::from(RATE) {
        let note = if n % 2 == 0 { 45.0 } else { 52.0 };
        play(engine, slot, frame, note, step * 0.9);
        frame += step;
        n += 1;
    }
}

#[test]
fn an_empty_chain_is_bit_identical_to_no_chain() {
    for name in ["bass", "pad", "kick", "piano"] {
        let mut plain = engine(RATE);
        let a = live_slot(&mut plain, name);
        groove(&mut plain, a, 1.0);
        let mut committed = engine(RATE);
        let b = live_slot(&mut committed, name);
        assert!(committed.effects_commit(b, 0, 0.0));
        groove(&mut committed, b, 1.0);
        let x = render(&mut plain, 0.0, SECOND);
        let y = render(&mut committed, 0.0, SECOND);
        assert!(
            x.left == y.left && x.right == y.right,
            "{name}: an empty chain changed the output"
        );
    }
}

#[test]
fn leaving_the_chain_returns_to_the_phase_1_output() {
    let mut plain = engine(RATE);
    let a = live_slot(&mut plain, "bass");
    groove(&mut plain, a, 3.0);
    let mut chained = engine(RATE);
    let b = live_slot(&mut chained, "bass");
    insert_chain(&mut chained, b, &[0, 2], 0.0);
    assert!(chained.effects_commit(b, 0, 0.5 * f64::from(RATE)));
    groove(&mut chained, b, 3.0);
    let x = render(&mut plain, 0.0, 3 * SECOND);
    let y = render(&mut chained, 0.0, 3 * SECOND);
    // After the 20 ms fade back to dry the slot is mono again: identical from 1 s on.
    // (The shared reverb and delay are silent: no sends.)
    let tail = 2 * SECOND..3 * SECOND;
    let diff = x.left[tail.clone()]
        .iter()
        .zip(&y.left[tail])
        .fold(0.0_f32, |m, (p, q)| m.max((p - q).abs()));
    assert!(diff < 1e-6, "dry again after leaving the chain: {diff}");
}

#[test]
fn a_new_order_crossfades_without_a_step() {
    const OLD: [u32; 2] = [0, 4];
    const NEW: [u32; 4] = [2, 6, 0, 5];
    let switch = SECOND + 300;
    let window = switch - 2_000..switch + 4_000;
    // The same pad note through one chain, the other, or both with the switch between.
    let pad = |orders: &[(&[u32], f64)]| {
        let mut engine = engine(RATE);
        let slot = live_slot(&mut engine, "pad");
        play(&mut engine, slot, 0.0, 57.0, 4.0 * f64::from(RATE));
        for &(order, frame) in orders {
            insert_chain(&mut engine, slot, order, frame);
        }
        render(&mut engine, 0.0, 3 * SECOND)
    };
    let switched = pad(&[(&OLD, 0.0), (&NEW, switch as f64)]);
    assert!(switched.is_finite());
    // The steps each chain makes on its own in the same window: the pad's saws, drifting,
    // make the largest step of a window a property of the window, not of the
    // chain, so the switch is measured against both chains at that very moment.
    let old = largest_step(&pad(&[(&OLD, 0.0)]).left, window.clone());
    let new = largest_step(&pad(&[(&NEW, 0.0)]).left, window.clone());
    let around = largest_step(&switched.left, window);
    // No click: the switch adds less than −40 dBFS (0.01) to the largest step.
    assert!(
        around < old.max(new) + 0.01,
        "old chain {old}, new chain {new}, around the switch {around}"
    );
}

#[test]
fn a_short_note_through_chorus_rings_out_and_the_slot_finishes() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "pluck");
    insert_chain(&mut engine, slot, &[4], 0.0);
    engine.param_set(slot, (EFFECT_BASE + 6) as u32, 1.0);
    play(&mut engine, slot, 0.0, 60.0, 2_000.0);
    let out = render(&mut engine, 0.0, SECOND);
    assert!(out.is_finite() && out.peak() > 0.01);
    // The tail decays without a jump above −60 dBFS once the note has faded.
    let late = largest_step(&out.left, SECOND / 2..SECOND);
    assert!(
        late < 0.001 + largest_step(&out.left, SECOND / 4..SECOND / 2),
        "late step {late}"
    );
    engine.instance_retire(slot, SECOND as f64);
    let mut frame = SECOND as f64;
    for _ in 0..(20 * SECOND / BLOCK) {
        engine.render(frame, BLOCK);
        frame += BLOCK as f64;
        if engine.slot_lifecycle(slot, frame) == Some(Lifecycle::Finished) {
            return;
        }
    }
    panic!("a slot with a chorus tail never finished");
}

#[test]
fn nan_in_the_chain_resets_voices_and_chain() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "supersaw");
    insert_chain(&mut engine, slot, &EVERY_EFFECT, 0.0);
    play(&mut engine, slot, 0.0, 60.0, 48_000.0);
    render(&mut engine, 0.0, 4 * BLOCK);
    engine.poison_slot(slot);
    let out = render(&mut engine, (4 * BLOCK) as f64, 2 * BLOCK);
    assert!(out.is_finite());
    assert_eq!(engine.stats().get(NAN_RESETS), 1.0);
}

#[test]
fn a_repeated_effect_refuses_the_commit_and_keeps_the_chain() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "bass");
    assert!(engine.effect_order(slot, 0, 2));
    assert!(engine.effect_order(slot, 1, 2));
    assert!(!engine.effects_commit(slot, 2, 0.0));
    assert!(!engine.effect_order(slot, 9, 0), "position past 8");
    assert!(!engine.effect_order(slot, 0, 9), "kind past 8");
    assert!(!engine.effects_commit(slot, 10, 0.0), "count past 9");
    assert!(!engine.effects_commit(99, 0, 0.0), "unknown slot");
}

#[test]
fn every_effect_with_extreme_values_stays_finite() {
    for &(name, note) in &[("bass", 33.0), ("hat", HIT), ("piano", 84.0)] {
        let mut engine = engine(RATE);
        let slot = live_slot(&mut engine, name);
        insert_chain(&mut engine, slot, &EVERY_EFFECT, 0.0);
        for position in 0..16 {
            let index = (EFFECT_BASE + position) as u32;
            engine.param_set(slot, index, if position % 2 == 0 { 1e9 } else { -1e9 });
        }
        for i in 0..20 {
            play(&mut engine, slot, f64::from(i) * 2_400.0, note, 2_000.0);
        }
        let out = render(&mut engine, 0.0, SECOND);
        assert!(out.is_finite(), "{name}");
        assert!(out.peak() <= 1.0, "{name}: {}", out.peak());
    }
}

#[test]
fn a_fast_lfo_moves_the_parameter_and_locks_it() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "pad");
    // gain: square LFO between 0.1 and 1 at an eighth of a second.
    assert!(engine.modulator_set(slot, GAIN as u32, 3, 0, 6_000.0, 0.0, 0.1, 1.0));
    engine.param_set(slot, GAIN as u32, 0.5);
    play(&mut engine, slot, 0.0, 57.0, 2.0 * f64::from(RATE));
    let out = render(&mut engine, 0.0, SECOND);
    let quiet = rms(&out.left[1_000..2_900]);
    let loud = rms(&out.left[4_000..5_900]);
    assert!(loud > 4.0 * quiet, "loud {loud} quiet {quiet}");
    assert!(engine.modulator_clear(slot, GAIN as u32));
    assert!(!engine.modulator_clear(slot, GAIN as u32));
}

#[test]
fn modulators_are_refused_where_the_design_forbids_them() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "acid");
    // duck (6), sends (2, 4), glide (7): slow signals only.
    for param in [2, 4, 6, 7, 3, 5, 8] {
        assert!(
            !engine.modulator_set(slot, param, 0, 0, 100.0, 0.0, 0.0, 1.0),
            "{param}"
        );
    }
    // wave is a choice of acid: never modulated.
    let wave = INSTRUMENT_BASE as u32 + 3;
    assert!(!engine.envelope_set(slot, wave, 0, 0.1, 0.0, 1.0));
    for param in 0..8 {
        assert!(engine.modulator_set(
            slot,
            (EFFECT_BASE + param) as u32,
            0,
            0,
            100.0,
            0.0,
            0.0,
            1.0
        ));
    }
    assert!(
        !engine.modulator_set(slot, (EFFECT_BASE + 8) as u32, 0, 0, 100.0, 0.0, 0.0, 1.0),
        "ninth"
    );
}

#[test]
fn an_envelope_restarts_on_every_note() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "sub");
    // gain jumps to 1 on every note and falls to 0.05 in 50 ms.
    assert!(engine.envelope_set(slot, GAIN as u32, 0, 0.05, 1.0, 0.05));
    for i in 0..4 {
        play(&mut engine, slot, f64::from(i) * 12_000.0, 45.0, 11_000.0);
    }
    let out = render(&mut engine, 0.0, SECOND);
    for i in 0..4 {
        let start = i * 12_000;
        let early = rms(&out.left[start + 200..start + 1_000]);
        let late = rms(&out.left[start + 8_000..start + 10_000]);
        assert!(early > 5.0 * late, "note {i}: early {early} late {late}");
    }
}

fn rms(x: &[f32]) -> f32 {
    (x.iter().map(|v| v * v).sum::<f32>() / x.len() as f32).sqrt()
}
