// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! After `untzel_stop`, the output is the output of the same groove without the
//! discarded future events, times a linear 20 ms fade (no step beyond the ramp's), then
//! silence; a new play sounds again after the clear.

mod common;

use common::{HIT, engine, live_slot, play, render};
use untzel_dsp::engine::Engine;
use untzel_dsp::params::{DELAY_SEND, REVERB_SEND};
use untzel_dsp::slot::BLOCK;

/// Events at or after `until` are left out (they are what `stop` discards).
fn groove(sample_rate: f32, until: f64) -> Engine {
    let mut engine = engine(sample_rate);
    let kick = live_slot(&mut engine, "kick");
    let bass = live_slot(&mut engine, "bass");
    for slot in [kick, bass] {
        engine.param_set(slot, REVERB_SEND as u32, 0.4);
        engine.param_set(slot, DELAY_SEND as u32, 0.35);
    }
    let beat = f64::from(sample_rate) * 60.0 / 132.0;
    for n in 0..16 {
        for (slot, at, note, length) in [
            (kick, beat * n as f64, HIT, beat / 2.0),
            (bass, beat * (n as f64 + 0.5), 36.0, beat / 3.0),
        ] {
            if at < until {
                play(&mut engine, slot, at, note, length);
            }
        }
    }
    engine
}

#[test]
fn stop_fades_linearly_in_20_ms_then_goes_silent() {
    for sample_rate in common::RATES {
        let stop_at = 20_000.0 + 37.0;
        let mut reference = groove(sample_rate, stop_at);
        let mut stopped = groove(sample_rate, f64::INFINITY);
        let ramp = stopped.ramp_frames() as usize;
        let total = BLOCK * 400;
        let expected = render(&mut reference, 0.0, total);
        let before = render(&mut stopped, 0.0, BLOCK * 150);
        stopped.stop(stop_at);
        let after = render(&mut stopped, (BLOCK * 150) as f64, total - BLOCK * 150);
        let left: Vec<f32> = before.left.iter().chain(&after.left).copied().collect();
        let at = stop_at as usize;
        assert!(expected.peak() > 0.1);
        for (n, (&actual, &unstopped)) in
            left.iter().zip(&expected.left).take(at + ramp).enumerate()
        {
            let fade = if n < at {
                1.0
            } else {
                1.0 - (n - at) as f32 / ramp as f32
            };
            assert!(
                (actual - unstopped * fade).abs() <= 1e-6,
                "{sample_rate} Hz, frame {n}"
            );
        }
        assert!(
            left[at + ramp..].iter().all(|&x| x == 0.0),
            "silent after the fade"
        );
    }
}

#[test]
fn a_play_after_stop_sounds_again() {
    let sample_rate = 48_000.0;
    let mut engine = groove(sample_rate, f64::INFINITY);
    render(&mut engine, 0.0, BLOCK * 100);
    engine.stop((BLOCK * 100) as f64);
    let start = (BLOCK * 100) as f64 + 0.120 * f64::from(sample_rate);
    let kick = 0;
    play(&mut engine, kick, start, HIT, 4_800.0);
    let out = render(&mut engine, (BLOCK * 100) as f64, BLOCK * 200);
    let onset = (start as usize - BLOCK * 100) + engine.latency_frames();
    assert!(out.left[..onset].iter().skip(1_000).all(|&x| x == 0.0));
    assert!(
        out.left[onset..onset + 4_800]
            .iter()
            .any(|&x| x.abs() > 0.1)
    );
    assert_eq!(
        engine.stats().slot(kick as usize).onset_count,
        2.0,
        "beat 0, then the new play"
    );
}
