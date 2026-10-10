// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The master chain: with 64 instances at full gain hitting together the limiter never
//! passes 0 dBFS (its ceiling is −1 dBFS); a 10 s offline render of the onboard groove
//! is non-silent; every `kick` slot ducks the others.

mod common;

use common::{HIT, RATES, engine, live_slot, play, render, render_slot};
use untzel_dsp::engine::Engine;
use untzel_dsp::instruments::bass;
use untzel_dsp::params::{DELAY_SEND, DUCK, GAIN, INSTRUMENT_BASE, REVERB_SEND};
use untzel_dsp::slot::BLOCK;

const CEILING: f32 = 0.891_250_9; // −1 dBFS

#[test]
fn sixty_four_instances_never_pass_0_dbfs() {
    for sample_rate in RATES {
        let mut engine = engine(sample_rate);
        let names = ["kick", "hat", "bass"];
        let beat = f64::from(sample_rate) * 60.0 / 132.0;
        for i in 0..64 {
            let name = names[i % 3];
            let slot = live_slot(&mut engine, name);
            engine.param_set(slot, GAIN as u32, 1.0);
            engine.param_set(slot, REVERB_SEND as u32, 1.0);
            engine.param_set(slot, DELAY_SEND as u32, 1.0);
            for n in 0..20 {
                let note = if name == "bass" {
                    24.0 + (i % 12) as f32
                } else {
                    HIT
                };
                play(&mut engine, slot, beat * n as f64, note, beat);
            }
        }
        let out = render(
            &mut engine,
            0.0,
            (10.0 * sample_rate) as usize / BLOCK * BLOCK,
        );
        assert!(out.is_finite());
        let peak = out.peak();
        assert!(peak <= CEILING + 1e-6, "{sample_rate} Hz: peak {peak}");
        assert!(peak > 0.5, "the limiter is not just silence: {peak}");
    }
}

/// The onboard template, roughly: four-on-the-floor kick, off-beat hat, two basses.
fn groove(sample_rate: f32) -> Engine {
    let mut engine = engine(sample_rate);
    let kick = live_slot(&mut engine, "kick");
    let hat = live_slot(&mut engine, "hat");
    let sub = live_slot(&mut engine, "bass");
    let bass = live_slot(&mut engine, "bass");
    for slot in [sub, bass] {
        engine.param_set(slot, DUCK as u32, 0.6);
    }
    engine.param_set(hat, REVERB_SEND as u32, 0.3);
    engine.param_set(bass, DELAY_SEND as u32, 0.35);
    engine.tempo(132.0, 0.0);
    let step = f64::from(sample_rate) * 60.0 / 132.0 / 4.0;
    for n in 0..(10.0 * f64::from(sample_rate) / step) as usize {
        let at = step * n as f64;
        if n % 4 == 0 {
            play(&mut engine, kick, at, HIT, step);
        }
        if n % 4 == 2 {
            play(&mut engine, hat, at, HIT, step);
        }
        if [0, 3, 6].contains(&(n % 8)) {
            play(&mut engine, sub, at, 24.0, step);
        }
        if [1, 3, 5].contains(&(n % 8)) {
            play(&mut engine, bass, at, 36.0, step);
        }
    }
    engine
}

#[test]
fn a_ten_second_offline_render_is_not_silent() {
    for sample_rate in RATES {
        let mut engine = groove(sample_rate);
        let frames = (10.0 * sample_rate) as usize / BLOCK * BLOCK;
        let out = render(&mut engine, 0.0, frames);
        assert!(out.is_finite());
        assert!(out.rms() > 0.02, "{sample_rate} Hz: rms {}", out.rms());
        let second = sample_rate as usize;
        for s in 0..9 {
            let window = &out.left[s * second..(s + 1) * second];
            assert!(
                window.iter().any(|x| x.abs() > 0.05),
                "second {s} is silent"
            );
        }
        assert!(out.peak() <= CEILING + 1e-6);
    }
}

#[test]
fn every_kick_slot_ducks_a_bass() {
    let sample_rate = 48_000.0;
    // Three kick slots exist; only `playing` sounds. Whichever it is, it must duck.
    let level_with = |playing: usize, duck: f32| {
        let mut engine = engine(sample_rate);
        let bass = live_slot(&mut engine, "bass");
        engine.param_set(bass, DUCK as u32, duck);
        engine.param_set(bass, (INSTRUMENT_BASE + bass::DECAY) as u32, 2.0);
        play(&mut engine, bass, 0.0, 36.0, 96_000.0);
        let kicks: Vec<u32> = (0..3).map(|_| live_slot(&mut engine, "kick")).collect();
        play(&mut engine, kicks[playing], 12_000.0, HIT, 4_800.0);
        let _ = render_slot(&mut engine, bass, 0.0, BLOCK * 50);
        render(&mut engine, (BLOCK * 50) as f64, BLOCK * 150).rms()
    };
    // Same kick, same bass: duck 1 makes the mix quieter than duck 0.
    for playing in 0..3 {
        assert!(
            level_with(playing, 1.0) < level_with(playing, 0.0),
            "kick slot {playing}"
        );
    }
}
