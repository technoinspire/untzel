// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! No allocation on the audio thread with sample packs: the delivery of a
//! pack inside `render`, sampled `vox` (legato across zones) and `choir` chords, and the
//! stop that resets their voices. Same counting allocator as `no_alloc.rs`; one `#[test]`.

mod common;

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use common::{engine, live_slot, play};
use untzel_dsp::engine::Engine;
use untzel_dsp::engines::sampler::ZONE_CELLS;
use untzel_dsp::instruments::vox;
use untzel_dsp::params::{INSTRUMENT_BASE, LEGATO};
use untzel_dsp::slot::BLOCK;

struct CountingAllocator;

thread_local! {
    static HEAP_CALLS: Cell<usize> = const { Cell::new(0) };
}

unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        HEAP_CALLS.with(|count| count.set(count.get() + 1));
        unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        HEAP_CALLS.with(|count| count.set(count.get() + 1));
        unsafe { System.dealloc(pointer, layout) }
    }

    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        HEAP_CALLS.with(|count| count.set(count.get() + 1));
        unsafe { System.realloc(pointer, layout, size) }
    }
}

#[global_allocator]
static ALLOCATOR: CountingAllocator = CountingAllocator;

const RATE: f32 = 48_000.0;

/// A pack of `zones` sine stems a fourth apart, aah and ooh, left and right.
fn commit_pack(engine: &mut Engine, instrument: &str, at_frame: f64) {
    const STEM: usize = 9_600;
    let roots = [48.0, 53.0, 58.0, 63.0, 68.0, 73.0];
    let stems = roots.len() * 4;
    let library = engine.samples_mut();
    assert!(library.reserve(
        common::instrument_id(instrument),
        (stems * STEM) as u32,
        stems as u32,
        RATE
    ));
    let (pcm, zones) = library.upload_mut().unwrap();
    for (index, x) in pcm.iter_mut().enumerate() {
        *x = (((index % 97) as f32 / 97.0 * core::f32::consts::TAU).sin() * 8_000.0) as i16;
    }
    for stem in 0..stems {
        let root: f64 = roots[stem / 4];
        let start = (stem * STEM) as f64;
        let cells = [
            (stem % 2) as f64,
            root - 2.5,
            root + 2.5,
            root,
            start,
            start + 2_400.0,
            start + STEM as f64,
            if stem % 4 < 2 { -0.55 } else { 0.55 },
        ];
        zones[stem * ZONE_CELLS..(stem + 1) * ZONE_CELLS].copy_from_slice(&cells);
    }
    assert!(library.commit(at_frame));
}

fn counted_render(engine: &mut Engine, frame: f64) -> usize {
    let before = HEAP_CALLS.with(Cell::get);
    engine.render(frame, BLOCK);
    HEAP_CALLS.with(Cell::get) - before
}

#[test]
fn sample_voices_never_touch_the_heap_on_the_audio_thread() {
    let mut engine = engine(RATE);
    let mut slots = Vec::new();
    for index in 0..16 {
        let name = if index % 2 == 0 { "choir" } else { "vox" };
        let slot = live_slot(&mut engine, name);
        if name == "vox" {
            engine.param_set(slot, (INSTRUMENT_BASE + vox::SOURCE) as u32, 1.0);
            engine.param_set(slot, LEGATO as u32, 1.0);
        }
        slots.push(slot);
    }
    // The packs arrive at 0.5 s: their delivery happens inside render.
    commit_pack(&mut engine, "choir", 24_000.0);
    commit_pack(&mut engine, "vox", 24_000.0);
    for (index, &slot) in slots.iter().enumerate() {
        for step in 0..40 {
            let note = 50.0 + ((step * 7 + index) % 24) as f32;
            play(&mut engine, slot, step as f64 * 4_800.0, note, 6_000.0);
        }
    }
    let mut calls = 0;
    let mut frame = 0.0;
    for _ in 0..(4.0 * RATE) as usize / BLOCK {
        calls += counted_render(&mut engine, frame);
        frame += BLOCK as f64;
    }
    engine.stop(frame);
    for _ in 0..(0.5 * RATE) as usize / BLOCK {
        calls += counted_render(&mut engine, frame);
        frame += BLOCK as f64;
    }
    let voices: f64 = slots
        .iter()
        .map(|&slot| engine.stats().slot(slot as usize).active_voices)
        .sum();
    assert_eq!(voices, 0.0, "the stop silenced every voice");
    assert_eq!(calls, 0, "heap calls inside render with sample packs");
}
