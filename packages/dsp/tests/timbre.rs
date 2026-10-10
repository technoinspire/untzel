// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Automatic timbre checks: the piano partials follow the
//! inharmonicity table, the bass rings longer than the treble, and every instrument
//! is deterministic (the same events give bit-identical audio) and audible.

mod common;

use common::{HIT, engine, live_slot, play, render, render_slot};
use untzel_dsp::instruments::INSTRUMENT_NAMES;
use untzel_dsp::instruments::piano::{inharmonicity, partial_hz};
use untzel_dsp::math::midi_to_hz;
use untzel_dsp::slot::BLOCK;

const RATE: f32 = 48_000.0;

/// Magnitude of the spectrum at `hz` with a Hann window; the oscillator is rotated
/// by complex multiplication, so there is no trigonometry per sample.
fn magnitude(signal: &[f32], hz: f32) -> f64 {
    let n = signal.len();
    let w = 2.0 * core::f64::consts::PI * f64::from(hz) / f64::from(RATE);
    let (step_re, step_im) = (w.cos(), -w.sin());
    let wn = 2.0 * core::f64::consts::PI / n as f64;
    let (window_re, window_im) = (wn.cos(), wn.sin());
    let (mut osc_re, mut osc_im) = (1.0_f64, 0.0_f64);
    let (mut win_re, mut win_im) = (1.0_f64, 0.0_f64);
    let (mut re, mut im) = (0.0_f64, 0.0_f64);
    for &x in signal {
        let window = 0.5 - 0.5 * win_re;
        let value = f64::from(x) * window;
        re += value * osc_re;
        im += value * osc_im;
        let next_re = osc_re * step_re - osc_im * step_im;
        osc_im = osc_re * step_im + osc_im * step_re;
        osc_re = next_re;
        let next_win = win_re * window_re - win_im * window_im;
        win_im = win_re * window_im + win_im * window_re;
        win_re = next_win;
    }
    (re * re + im * im).sqrt()
}

/// Frequency of the strongest bin within ±`span` Hz of `around`: 0.5 Hz steps, then
/// 0.05 Hz steps around the best.
fn peak_near(signal: &[f32], around: f32, span: f32) -> f32 {
    let search = |from: f32, to: f32, step: f32| {
        let mut best = (from, -1.0);
        let mut hz = from;
        while hz <= to {
            let value = magnitude(signal, hz);
            if value > best.1 {
                best = (hz, value);
            }
            hz += step;
        }
        best.0
    };
    let coarse = search(around - span, around + span, 0.5);
    search(coarse - 0.5, coarse + 0.5, 0.05)
}

fn piano_note(note: f32, seconds: f32) -> Vec<f32> {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "piano");
    play(&mut engine, slot, 0.0, note, f64::from(RATE * seconds));
    render_slot(
        &mut engine,
        slot,
        0.0,
        (RATE * seconds) as usize / BLOCK * BLOCK,
    )
}

/// Least-squares `B` of measured partials: `(f_k / (k f_1))² − 1 ≈ B (k² − 1)`.
fn fitted_b(f1: f32, partials: &[(usize, f32)]) -> f32 {
    let (mut num, mut den) = (0.0_f64, 0.0_f64);
    for &(k, fk) in partials {
        let ratio = f64::from(fk) / (k as f64 * f64::from(f1));
        let x = (k * k - 1) as f64;
        num += (ratio * ratio - 1.0) * x;
        den += x * x;
    }
    (num / den) as f32
}

#[test]
fn piano_partials_follow_the_inharmonicity_table() {
    for note in [45.0, 57.0, 69.0, 81.0, 93.0] {
        let signal = piano_note(note, 2.0);
        let f0 = midi_to_hz(note);
        let b = inharmonicity(note);
        let mut measured = Vec::new();
        let mut model = Vec::new();
        for k in 1..=8_usize {
            let expected = partial_hz(f0, k, b);
            if expected > 10_000.0 {
                break;
            }
            measured.push((k, peak_near(&signal, expected, 2.0)));
            model.push((k, expected));
        }
        let f1 = measured[0].1;
        let measured_b = fitted_b(f1, &measured[1..]);
        let expected_b = fitted_b(model[0].1, &model[1..]);
        let error = (measured_b - expected_b).abs() / expected_b;
        println!(
            "piano note {note}: B measured {measured_b:.5}, table {expected_b:.5} ({:.1}%)",
            100.0 * error
        );
        assert!(error < 0.10, "note {note}: B {measured_b} vs {expected_b}");
    }
}

/// Seconds until the slot signal falls 60 dB below its first peak.
fn time_to_minus_60(signal: &[f32]) -> f32 {
    let window = 480;
    let peak = signal
        .iter()
        .take(4_800)
        .fold(0.0_f32, |m, x| m.max(x.abs()));
    for (index, chunk) in signal.chunks(window).enumerate() {
        let level = chunk.iter().fold(0.0_f32, |m, x| m.max(x.abs()));
        if index > 2 && level < peak * 0.001 {
            return (index * window) as f32 / RATE;
        }
    }
    signal.len() as f32 / RATE
}

#[test]
fn the_piano_bass_rings_longer_than_the_treble() {
    let low = time_to_minus_60(&piano_note(45.0, 12.0));
    let high = time_to_minus_60(&piano_note(81.0, 12.0));
    println!("piano a2 {low:.2} s, a5 {high:.2} s to -60 dB");
    assert!(low > high, "a2 {low} s, a5 {high} s");
}

#[test]
fn every_instrument_is_deterministic_and_audible() {
    for name in INSTRUMENT_NAMES {
        let take = || {
            let mut engine = engine(RATE);
            let slot = live_slot(&mut engine, name);
            for (i, note) in [HIT, 48.0, 55.0, 60.0].into_iter().enumerate() {
                play(&mut engine, slot, (i * 6_000) as f64, note, 12_000.0);
            }
            render(&mut engine, 0.0, BLOCK * 400)
        };
        let first = take();
        let second = take();
        assert_eq!(first.left, second.left, "{name} is not deterministic");
        let peak = first.peak();
        println!(
            "{name}: peak {:.1} dBFS, rms {:.1} dBFS",
            20.0 * peak.log10(),
            20.0 * first.rms().log10()
        );
        assert!(peak > 1e-3, "{name} is silent");
        assert!(first.is_finite(), "{name}");
    }
}
