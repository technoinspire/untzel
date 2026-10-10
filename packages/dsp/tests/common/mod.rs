// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Helpers shared by the integration tests. Each test binary uses a subset.
#![allow(dead_code)]

use untzel_dsp::engine::Engine;
use untzel_dsp::events::{NoteEvent, ParamPoint};
use untzel_dsp::instruments::INSTRUMENT_NAMES;
use untzel_dsp::slot::BLOCK;

pub const RATES: [f32; 2] = [44_100.0, 48_000.0];
pub const HIT: f32 = -1.0;

pub fn instrument_id(name: &str) -> u32 {
    INSTRUMENT_NAMES
        .iter()
        .position(|candidate| *candidate == name)
        .unwrap_or_else(|| panic!("no instrument {name}")) as u32
}

pub fn engine(sample_rate: f32) -> Engine {
    Engine::new(sample_rate).expect("valid sample rate")
}

/// A slot of `name`, active from frame 0.
pub fn live_slot(engine: &mut Engine, name: &str) -> u32 {
    let slot = engine
        .instance_create(instrument_id(name))
        .expect("known instrument");
    engine.instance_activate(slot, 0.0);
    slot
}

pub fn play(engine: &mut Engine, slot: u32, frame: f64, note: f32, duration: f64) {
    engine
        .event_push(NoteEvent {
            slot,
            frame,
            duration,
            note,
            velocity: 1.0,
        })
        .expect("room in the queue");
}

pub fn ramp(engine: &mut Engine, slot: u32, param: u32, frame: f64, value: f32, frames: u32) {
    engine
        .param_push(ParamPoint {
            slot,
            frame,
            param,
            value,
            ramp: frames,
        })
        .expect("room in the queue");
}

#[derive(Default)]
pub struct Rendered {
    pub left: Vec<f32>,
    pub right: Vec<f32>,
}

impl Rendered {
    pub fn peak(&self) -> f32 {
        self.left
            .iter()
            .chain(&self.right)
            .fold(0.0_f32, |max, x| max.max(x.abs()))
    }

    pub fn rms(&self) -> f32 {
        let sum: f64 = self
            .left
            .iter()
            .chain(&self.right)
            .map(|&x| f64::from(x) * f64::from(x))
            .sum();
        (sum / (2 * self.left.len()) as f64).sqrt() as f32
    }

    pub fn is_finite(&self) -> bool {
        self.left.iter().chain(&self.right).all(|x| x.is_finite())
    }
}

/// Renders `frames` (a multiple of 128) from `start`, block by block.
pub fn render(engine: &mut Engine, start: f64, frames: usize) -> Rendered {
    let mut rendered = Rendered::default();
    for block in 0..frames / BLOCK {
        engine.render(start + (block * BLOCK) as f64, BLOCK);
        let output = engine.output();
        rendered.left.extend_from_slice(&output[..BLOCK]);
        rendered.right.extend_from_slice(&output[BLOCK..]);
    }
    rendered
}

/// Renders like `render` and returns the mono signal of `slot` instead of the mix.
pub fn render_slot(engine: &mut Engine, slot: u32, start: f64, frames: usize) -> Vec<f32> {
    let mut signal = Vec::with_capacity(frames);
    for block in 0..frames / BLOCK {
        engine.render(start + (block * BLOCK) as f64, BLOCK);
        signal.extend_from_slice(engine.slot_signal(slot).expect("live slot"));
    }
    signal
}

/// Largest absolute difference between neighbouring samples in `range`.
pub fn largest_step(signal: &[f32], range: core::ops::Range<usize>) -> f32 {
    signal[range.start.max(1)..range.end]
        .iter()
        .zip(&signal[range.start.max(1) - 1..range.end - 1])
        .fold(0.0_f32, |max, (b, a)| max.max((b - a).abs()))
}

/// Deterministic generator for sweeps (mulberry32).
pub struct Random(u32);

impl Random {
    pub fn new(seed: u32) -> Self {
        Random(seed)
    }

    pub fn next_f32(&mut self) -> f32 {
        self.0 = self.0.wrapping_add(0x6d2b_79f5);
        let mut t = self.0;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        ((t ^ (t >> 14)) as f32) / 4_294_967_296.0
    }

    pub fn below(&mut self, limit: u32) -> u32 {
        ((self.next_f32() * limit as f32) as u32).min(limit - 1)
    }
}

/// Puts every insert effect on `slot`, in `order`, from `at_frame`, with audible values.
pub fn insert_chain(engine: &mut Engine, slot: u32, order: &[u32], at_frame: f64) {
    use untzel_dsp::params::EFFECT_BASE;
    for (position, &kind) in order.iter().enumerate() {
        assert!(engine.effect_order(slot, position as u32, kind));
    }
    assert!(engine.effects_commit(slot, order.len() as u32, at_frame));
    let base = EFFECT_BASE as u32;
    for (position, value) in [
        (0, 4_000.0),
        (2, 80.0),
        (4, 0.5),
        (5, 0.4),
        (6, 0.6),
        (8, 0.6),
        (10, 3.0),
        (11, -3.0),
        (13, 4.0),
        (14, 0.6),
        (15, 0.2),
    ] {
        engine.param_set(slot, base + position, value);
    }
}

/// The nine kinds, lowpass … gate.
pub const EVERY_EFFECT: [u32; 9] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
