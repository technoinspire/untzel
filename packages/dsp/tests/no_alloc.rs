// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! No allocation and no deallocation on the audio thread, across the instrument
//! library: 64 slots of every instrument with every send in use render 10 s; then
//! the three paths that reset voices inside `render` (the end of a stop fade, a
//! retiring slot reaching `Finished`, and the NaN recovery) run with the counter on.
//! The counting allocator counts per thread (`thread_local!`, const) and the file holds
//! a single `#[test]`.

mod common;

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use common::{EVERY_EFFECT, HIT, engine, insert_chain, live_slot, play};
use untzel_dsp::engine::Engine;
use untzel_dsp::instruments::INSTRUMENT_NAMES;
use untzel_dsp::params::{DELAY_DIVISION, DELAY_SEND, REVERB_SEND, REVERB_SPACE};
use untzel_dsp::slot::{BLOCK, Lifecycle};

struct CountingAllocator;

thread_local! {
    static ALLOCATIONS: Cell<usize> = const { Cell::new(0) };
    static DEALLOCATIONS: Cell<usize> = const { Cell::new(0) };
}

unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCATIONS.with(|count| count.set(count.get() + 1));
        unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        DEALLOCATIONS.with(|count| count.set(count.get() + 1));
        unsafe { System.dealloc(pointer, layout) }
    }

    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        ALLOCATIONS.with(|count| count.set(count.get() + 1));
        unsafe { System.realloc(pointer, layout, size) }
    }
}

#[global_allocator]
static ALLOCATOR: CountingAllocator = CountingAllocator;

/// Allocations plus deallocations so far on this thread.
fn heap_calls() -> usize {
    ALLOCATIONS.with(Cell::get) + DEALLOCATIONS.with(Cell::get)
}

/// Renders one block and returns the heap calls it made.
fn counted_render(engine: &mut Engine, frame: f64) -> usize {
    let before = heap_calls();
    engine.render(frame, BLOCK);
    heap_calls() - before
}

const SAMPLE_RATE: f32 = 48_000.0;

/// One slot of every instrument, each playing a burst of notes; every other slot runs
/// the full insert chain and a fast LFO on `gain`.
fn every_instrument(engine: &mut Engine) -> Vec<u32> {
    let slots: Vec<u32> = INSTRUMENT_NAMES
        .iter()
        .map(|name| live_slot(engine, name))
        .collect();
    for &slot in slots.iter().step_by(2) {
        insert_chain(engine, slot, &EVERY_EFFECT, 0.0);
        assert!(engine.modulator_set(slot, 0, 0, 0, 6_000.0, 0.0, 0.4, 1.0));
    }
    for &slot in &slots {
        for (i, note) in [HIT, 48.0, 55.0, 60.0, 63.0].into_iter().enumerate() {
            play(engine, slot, (i * 300) as f64, note, 30_000.0);
        }
    }
    slots
}

fn render_seconds(engine: &mut Engine, start: f64, seconds: f32) -> (f64, usize) {
    let mut frame = start;
    let mut calls = 0;
    for _ in 0..(seconds * SAMPLE_RATE) as usize / BLOCK {
        calls += counted_render(engine, frame);
        frame += BLOCK as f64;
    }
    (frame, calls)
}

#[test]
fn the_audio_thread_never_touches_the_heap() {
    assert_eq!(
        sixty_four_slots_for_ten_seconds(),
        0,
        "heap calls inside render at scale"
    );
    assert_eq!(
        stop_fade_until_reset(),
        0,
        "heap calls while a stop resets the voices"
    );
    assert_eq!(
        retire_until_finished(),
        0,
        "heap calls while slots retire to Finished"
    );
    assert_eq!(nan_recovery(), 0, "heap calls in the NaN recovery");
}

fn sixty_four_slots_for_ten_seconds() -> usize {
    let mut engine = engine(SAMPLE_RATE);
    let count = INSTRUMENT_NAMES.len();
    let slots: Vec<u32> = (0..64)
        .map(|i| {
            let slot = live_slot(&mut engine, INSTRUMENT_NAMES[i % count]);
            engine.param_set(slot, REVERB_SEND as u32, 0.3);
            engine.param_set(slot, REVERB_SPACE as u32, (i % 3) as f32);
            engine.param_set(slot, DELAY_SEND as u32, 0.35);
            engine.param_set(slot, DELAY_DIVISION as u32, (i % 3) as f32);
            if i % 2 == 0 {
                insert_chain(&mut engine, slot, &EVERY_EFFECT, 0.0);
                assert!(engine.envelope_set(slot, 0, 0, 0.2, 1.0, 0.3));
            }
            if i % 8 == 1 {
                // A reorder in the middle of the run.
                insert_chain(&mut engine, slot, &[2, 0, 4], 3.0 * f64::from(SAMPLE_RATE));
            }
            slot
        })
        .collect();
    let sixteenth = 60.0 * f64::from(SAMPLE_RATE) / 132.0 / 4.0;
    let blocks = (10.0 * SAMPLE_RATE) as usize / BLOCK;
    let mut scheduled_until = 0.0;
    let mut steps = 0_u64;
    let mut in_render = 0;
    for block in 0..blocks {
        let frame = (block * BLOCK) as f64;
        // Message handler: schedule the next 120 ms, as the transport does.
        while scheduled_until < frame + 0.120 * f64::from(SAMPLE_RATE) {
            for (index, &slot) in slots.iter().enumerate() {
                let note = if index % 2 == 0 {
                    HIT
                } else {
                    36.0 + (steps % 24) as f32
                };
                if index % 3 != 0 || steps.is_multiple_of(4) {
                    play(&mut engine, slot, scheduled_until, note, sixteenth * 2.0);
                }
            }
            steps += 1;
            scheduled_until = steps as f64 * sixteenth;
        }
        if block % 375 == 0 {
            engine.tempo(120.0 + (block % 2) as f64 * 12.0, frame + 64.0);
        }
        in_render += counted_render(&mut engine, frame);
    }
    let voices: f64 = (0..64)
        .map(|slot| engine.stats().slot(slot).active_voices)
        .sum();
    assert!(voices > 0.0);
    in_render
}

fn stop_fade_until_reset() -> usize {
    let mut engine = engine(SAMPLE_RATE);
    every_instrument(&mut engine);
    let (frame, _) = render_seconds(&mut engine, 0.0, 0.5);
    engine.stop(frame);
    // The fade (20 ms), the reset of every voice, then the chunked clear of the buses.
    let (_, calls) = render_seconds(&mut engine, frame, 0.5);
    calls
}

fn retire_until_finished() -> usize {
    let mut engine = engine(SAMPLE_RATE);
    let slots = every_instrument(&mut engine);
    let (mut frame, _) = render_seconds(&mut engine, 0.0, 0.5);
    for &slot in &slots {
        engine.instance_retire(slot, frame);
    }
    let mut calls = 0;
    for _ in 0..(40.0 * SAMPLE_RATE) as usize / BLOCK {
        calls += counted_render(&mut engine, frame);
        frame += BLOCK as f64;
        let finished = slots
            .iter()
            .all(|&slot| engine.slot_lifecycle(slot, frame) == Some(Lifecycle::Finished));
        if finished {
            return calls;
        }
    }
    panic!("not every slot finished within 40 s");
}

fn nan_recovery() -> usize {
    let mut engine = engine(SAMPLE_RATE);
    let slots = every_instrument(&mut engine);
    let (frame, _) = render_seconds(&mut engine, 0.0, 0.25);
    for &slot in &slots {
        engine.poison_slot(slot);
    }
    let calls = counted_render(&mut engine, frame);
    assert_eq!(
        engine.stats().get(untzel_dsp::stats::NAN_RESETS),
        slots.len() as f64,
        "every poisoned slot went through the recovery"
    );
    calls
}
