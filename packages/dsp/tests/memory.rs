// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Memory per instance: the slot stays small whatever the voice, and
//! the big voices live on the heap. Prints the measured size of every instance.

mod common;

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use common::{engine, instrument_id};
use untzel_dsp::instruments::INSTRUMENT_NAMES;
use untzel_dsp::slot::Slot;

struct MeasuringAllocator;

thread_local! {
    static LIVE_BYTES: Cell<isize> = const { Cell::new(0) };
}

unsafe impl GlobalAlloc for MeasuringAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        LIVE_BYTES.with(|bytes| bytes.set(bytes.get() + layout.size() as isize));
        unsafe { System.alloc(layout) }
    }
    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        LIVE_BYTES.with(|bytes| bytes.set(bytes.get() - layout.size() as isize));
        unsafe { System.dealloc(pointer, layout) }
    }
}

#[global_allocator]
static ALLOCATOR: MeasuringAllocator = MeasuringAllocator;

fn live_bytes() -> isize {
    LIVE_BYTES.with(Cell::get)
}

#[test]
fn a_slot_fits_in_four_kibibytes() {
    let size = core::mem::size_of::<Slot>();
    println!("size_of::<Slot>() = {size} B");
    assert!(size <= 4_096, "{size}");
}

#[test]
fn sixty_four_harps_are_created_on_a_small_stack() {
    // 256 KiB of stack: no temporary pool may cross it.
    let handle = std::thread::Builder::new()
        .stack_size(256 * 1024)
        .spawn(|| {
            let mut engine = engine(48_000.0);
            let harp = instrument_id("harp");
            for _ in 0..64 {
                engine.instance_create(harp).expect("created");
            }
        })
        .expect("thread");
    handle.join().expect("no stack overflow");
}

#[test]
fn every_instrument_reports_its_heap_size() {
    let mut largest = (String::new(), 0);
    for name in INSTRUMENT_NAMES {
        let mut engine = engine(48_000.0);
        // A first instance grows the slot table and the stats block once.
        engine
            .instance_create(instrument_id("kick"))
            .expect("created");
        let before = live_bytes();
        engine
            .instance_create(instrument_id(name))
            .expect("created");
        let bytes = live_bytes() - before;
        println!("{name}: {bytes} B per instance at 48 kHz");
        if bytes > largest.1 {
            largest = (name.to_string(), bytes);
        }
    }
    println!("largest: {} with {} B", largest.0, largest.1);
    assert!(
        largest.1 < 1 << 20,
        "no instance needs a mebibyte at 48 kHz"
    );
}
