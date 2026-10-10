// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! A `cutoff` ramp on `bass` is monotone sample by sample, whatever the sub-block
//! splits (events, other ramps, block edges), and lands exactly on its target.

mod common;

use common::{Random, instrument_id};
use untzel_dsp::instruments::{bass, parameter_ranges};
use untzel_dsp::params::{INSTRUMENT_BASE, ParamBank};
use untzel_dsp::slot::BLOCK;

/// Walks a bank through random sub-blocks the way the engine does (never crossing a
/// ramp end) and returns the voice's `cutoff` at every sample.
fn cutoff_per_sample(bank: &mut ParamBank, frames: usize, random: &mut Random) -> Vec<f32> {
    let mut values = Vec::with_capacity(frames);
    while values.len() < frames {
        let mut len = 1 + random.below(BLOCK as u32) as usize;
        if let Some(remaining) = bank.frames_to_next_ramp_end() {
            len = len.min(remaining as usize);
        }
        let params = bank.voice_params();
        values.extend((0..len).map(|n| params.at(bass::CUTOFF, n)));
        bank.advance(len as u32);
    }
    values
}

#[test]
fn a_cutoff_ramp_is_monotone_and_exact_across_any_split() {
    let ranges = parameter_ranges(instrument_id("bass") as usize).unwrap();
    for seed in 1..=20 {
        let mut random = Random::new(seed);
        let mut bank = ParamBank::new(&ranges, 960);
        let cutoff = INSTRUMENT_BASE + bass::CUTOFF;
        bank.ramp_to(cutoff, 1_400.0, 4_000);
        let rising = cutoff_per_sample(&mut bank, 4_000, &mut random);
        assert!(
            rising.windows(2).all(|w| w[1] >= w[0]),
            "seed {seed}: rising"
        );
        assert_eq!(bank.voice_params().at(bass::CUTOFF, 0), 1_400.0);

        bank.ramp_to(cutoff, 300.0, 1_234);
        let falling = cutoff_per_sample(&mut bank, 1_234, &mut random);
        assert!(
            falling.windows(2).all(|w| w[1] <= w[0]),
            "seed {seed}: falling"
        );
        assert_eq!(bank.voice_params().at(bass::CUTOFF, 0), 300.0);
    }
}
