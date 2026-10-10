// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The output stays finite: every min/default/max combination of every instrument, and
//! long random sweeps of events, parameters (in and out of range, NaN, ±∞), tempo and
//! master gain.

mod common;

use common::{HIT, Random, engine, live_slot, play, render};
use untzel_dsp::events::{NoteEvent, ParamPoint};
use untzel_dsp::instruments::{INSTRUMENT_NAMES, parameter_ranges};
use untzel_dsp::params::INSTRUMENT_BASE;
use untzel_dsp::slot::BLOCK;
use untzel_dsp::stats::NAN_RESETS;

/// Past this many parameters every combination of the extremes is too many (the VA
/// instruments have about twenty): the corners are sampled instead.
const EXHAUSTIVE_PARAMETERS: usize = 8;
/// Random extreme combinations of a sampled instrument.
const SAMPLED_CORNERS: usize = 160;

/// Every combination of min, default and max (or, past four parameters, of min and
/// max) over the instrument's parameters; past `EXHAUSTIVE_PARAMETERS`, a sample.
fn corners(id: usize) -> Vec<Vec<f32>> {
    let ranges = parameter_ranges(id).unwrap();
    if ranges.default.len() > EXHAUSTIVE_PARAMETERS {
        return sampled_corners(id);
    }
    let mut combinations = vec![Vec::new()];
    for local in 0..ranges.default.len() {
        // Up to four parameters: min, default and max. Beyond, every combination of
        // the extremes (min and max), so the count stays at most 3^4 or 2^n.
        let values: Vec<f32> = if ranges.default.len() <= 4 {
            vec![ranges.min[local], ranges.default[local], ranges.max[local]]
        } else {
            vec![ranges.min[local], ranges.max[local]]
        };
        combinations = combinations
            .into_iter()
            .flat_map(|prefix| {
                values.iter().map(move |&value| {
                    let mut next = prefix.clone();
                    next.push(value);
                    next
                })
            })
            .collect();
    }
    combinations
}

/// All minimums, all maximums, each parameter alone at its min and its max, and random
/// combinations of the extremes (seeded by the instrument, so a failure reproduces).
fn sampled_corners(id: usize) -> Vec<Vec<f32>> {
    let ranges = parameter_ranges(id).unwrap();
    let count = ranges.default.len();
    let mut corners = vec![ranges.min.to_vec(), ranges.max.to_vec()];
    for local in 0..count {
        for extreme in [ranges.min[local], ranges.max[local]] {
            let mut corner = ranges.default.to_vec();
            corner[local] = extreme;
            corners.push(corner);
        }
    }
    let mut random = Random::new(id as u32 + 1);
    for _ in 0..SAMPLED_CORNERS {
        corners.push(
            (0..count)
                .map(|local| {
                    if random.below(2) == 0 {
                        ranges.min[local]
                    } else {
                        ranges.max[local]
                    }
                })
                .collect(),
        );
    }
    corners
}

#[test]
fn every_parameter_corner_renders_finite_audio() {
    let sample_rate = 48_000.0;
    // One thread per instrument: 44 instruments, up to 3^6 corners each.
    std::thread::scope(|scope| {
        for (id, name) in INSTRUMENT_NAMES.iter().enumerate() {
            scope.spawn(move || {
                for (n, corner) in corners(id).iter().enumerate() {
                    let mut engine = engine(sample_rate);
                    let slot = live_slot(&mut engine, name);
                    for (local, &value) in corner.iter().enumerate() {
                        engine.param_set(slot, (INSTRUMENT_BASE + local) as u32, value);
                    }
                    let general = if n % 2 == 0 { 0.0 } else { 1.0 };
                    for param in 0..9 {
                        engine.param_set(slot, param, general);
                    }
                    for (i, note) in [HIT, 0.0, 24.0, 60.0, 127.0].into_iter().enumerate() {
                        play(&mut engine, slot, (i * 2_400) as f64, note, 1_200.0);
                    }
                    let out = render(&mut engine, 0.0, BLOCK * 160);
                    assert!(out.is_finite(), "{name} {corner:?}");
                    assert_eq!(engine.stats().get(NAN_RESETS), 0.0, "{name} {corner:?}");
                }
            });
        }
    });
}

/// A value from a menu of awkward inputs or a random one in `-2·span..2·span`.
fn awkward(random: &mut Random, span: f32) -> f32 {
    match random.below(12) {
        0 => f32::NAN,
        1 => f32::INFINITY,
        2 => f32::NEG_INFINITY,
        3 => 0.0,
        4 => -0.0,
        5 => f32::MAX,
        6 => f32::MIN_POSITIVE,
        _ => (random.next_f32() * 4.0 - 2.0) * span,
    }
}

#[test]
fn long_random_sweeps_never_produce_nan_or_infinity() {
    // Every instrument at both rates: 40 slots per rate, 15 s, split in four threads.
    std::thread::scope(|scope| {
        // Four groups of ten instruments per rate: 8 threads, 15 s each.
        let runs = [(1, 44_100.0_f32), (2, 48_000.0_f32)]
            .into_iter()
            .flat_map(|(seed, rate)| {
                (0..4_u32).map(move |group| (seed * 10 + group, rate, group as usize))
            });
        for (seed, sample_rate, group) in runs {
            scope.spawn(move || {
                let mut random = Random::new(seed);
                let mut engine = engine(sample_rate);
                let slots: Vec<u32> = (0..INSTRUMENT_NAMES.len())
                    .filter(|i| i % 4 == group)
                    .map(|i| live_slot(&mut engine, INSTRUMENT_NAMES[i]))
                    .collect();
                let blocks = (15.0 * sample_rate) as usize / BLOCK;
                for block in 0..blocks {
                    let frame = (block * BLOCK) as f64;
                    for _ in 0..random.below(4) {
                        let slot = slots[random.below(slots.len() as u32) as usize];
                        let at = frame + f64::from(random.below(600));
                        let _ = engine.event_push(NoteEvent {
                            slot,
                            frame: at,
                            duration: f64::from(awkward(&mut random, 50_000.0)),
                            note: if random.below(3) == 0 {
                                HIT
                            } else {
                                awkward(&mut random, 128.0)
                            },
                            velocity: awkward(&mut random, 1.0),
                        });
                        let _ = engine.param_push(ParamPoint {
                            slot,
                            frame: at,
                            param: random.below(48),
                            value: awkward(&mut random, 10_000.0),
                            ramp: random.below(4_000),
                        });
                    }
                    if random.below(200) == 0 {
                        engine.tempo(f64::from(awkward(&mut random, 300.0)), frame + 10.0);
                    }
                    if random.below(300) == 0 {
                        engine.master_gain(awkward(&mut random, 1.0));
                    }
                    engine.render(frame, BLOCK);
                    let output = engine.output();
                    assert!(
                        output.iter().all(|x| x.is_finite()),
                        "seed {seed}, block {block}"
                    );
                }
            });
        }
    });
}
