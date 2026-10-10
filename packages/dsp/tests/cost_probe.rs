// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Native cost probe (ignored by default): seconds of CPU per second of one voice of
//! every instrument. `cargo test -p untzel-dsp --release --test cost_probe -- --ignored
//! --nocapture`. The normative measure is `pnpm sim --costs` on the WASM.

use untzel_dsp::instruments::{INSTRUMENT_NAMES, InstrumentState, parameter_ranges, voice_count};
use untzel_dsp::slot::BLOCK;
use untzel_dsp::voice::Params;

#[test]
#[ignore]
fn native_cost_per_voice() {
    let rate = 48_000.0_f32;
    let seconds = 8.0;
    let blocks = (rate * seconds) as usize / BLOCK;
    for (id, name) in INSTRUMENT_NAMES.iter().enumerate() {
        let voices = voice_count(id);
        let ranges = parameter_ranges(id).unwrap();
        let step = vec![0.0_f32; ranges.default.len()];
        let params = Params {
            start: ranges.default,
            step: &step,
        };
        let mut best = f64::INFINITY;
        for _ in 0..7 {
            let mut state = InstrumentState::new(id, rate).unwrap();
            let mut out = [0.0_f32; BLOCK];
            let mut voice_blocks = 0_u64;
            let start = std::time::Instant::now();
            for block in 0..blocks {
                // Every voice busy: `voices` notes every 0.25 s, each held 0.25 s.
                if block % 94 == 0 {
                    for v in 0..voices {
                        state.trigger(48.0 + v as f32, 0.8, 12_000, 0, false, &params);
                    }
                }
                out.fill(0.0);
                voice_blocks += u64::from(state.render(&mut out, &params));
                std::hint::black_box(&out);
            }
            let elapsed = start.elapsed().as_secs_f64();
            let voice_seconds = voice_blocks as f64 * BLOCK as f64 / f64::from(rate);
            best = best.min(elapsed / voice_seconds.max(1e-9));
        }
        println!(
            "{name:>10}: {:.4}% of real time per voice ({voices} voices)",
            100.0 * best
        );
    }
}
