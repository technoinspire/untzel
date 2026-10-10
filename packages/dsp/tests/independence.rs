// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Two `bass` slots are independent: with the same notes and `cutoff` changed only on
//! slot A, slot B is bit for bit a `bass` slot alone at default parameters, and A
//! differs.

mod common;

use common::{RATES, engine, live_slot, play, ramp, render_slot};
use untzel_dsp::engine::Engine;
use untzel_dsp::instruments::bass;
use untzel_dsp::params::INSTRUMENT_BASE;
use untzel_dsp::slot::BLOCK;

const BLOCKS: usize = 400;

fn score(engine: &mut Engine, slot: u32, sample_rate: f32) {
    let step = f64::from(sample_rate) * 0.125;
    for (n, midi) in [36.0, 36.0, 39.0, 43.0, 36.0, 31.0].into_iter().enumerate() {
        play(engine, slot, 77.0 + step * n as f64, midi, step * 0.8);
    }
}

fn render_both(engine: &mut Engine, a: u32, b: u32) -> (Vec<f32>, Vec<f32>) {
    let (mut signal_a, mut signal_b) = (Vec::new(), Vec::new());
    for block in 0..BLOCKS {
        engine.render((block * BLOCK) as f64, BLOCK);
        signal_a.extend_from_slice(engine.slot_signal(a).unwrap());
        signal_b.extend_from_slice(engine.slot_signal(b).unwrap());
    }
    (signal_a, signal_b)
}

#[test]
fn two_bass_slots_do_not_share_state() {
    for sample_rate in RATES {
        let mut alone = engine(sample_rate);
        let reference = live_slot(&mut alone, "bass");
        score(&mut alone, reference, sample_rate);
        let expected = render_slot(&mut alone, reference, 0.0, BLOCKS * BLOCK);

        let mut pair = engine(sample_rate);
        let a = live_slot(&mut pair, "bass");
        let b = live_slot(&mut pair, "bass");
        score(&mut pair, a, sample_rate);
        score(&mut pair, b, sample_rate);
        let cutoff = (INSTRUMENT_BASE + bass::CUTOFF) as u32;
        pair.param_set(a, cutoff, 2_400.0);
        let ramp_frames = pair.ramp_frames();
        ramp(&mut pair, a, cutoff, 9_000.0, 300.0, ramp_frames);
        let (signal_a, signal_b) = render_both(&mut pair, a, b);

        assert!(expected.iter().any(|&x| x != 0.0));
        assert!(
            signal_b
                .iter()
                .zip(&expected)
                .all(|(x, y)| x.to_bits() == y.to_bits()),
            "{sample_rate} Hz: B must equal a bass alone, bit for bit"
        );
        assert!(signal_a.iter().zip(&expected).any(|(x, y)| x != y));
    }
}
