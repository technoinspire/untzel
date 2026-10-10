// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Raw C ABI of `untzel_dsp.wasm`, exactly as specified in `ABI.md` and mirrored by
//! `packages/audio/src/worklet/dsp-exports.ts`. Only `u32`, `f32` and `f64` cross the
//! boundary. One engine per WASM instance (each worklet has its own).
//!
//! The engine lives in a `thread_local!`: on `wasm32-unknown-unknown` without atomics
//! that is a plain static (no imports); in native tests it gives every test thread its
//! own engine, so the ABI can be exercised by tests running in parallel.

use core::cell::RefCell;

use crate::engine::Engine;
use crate::events::{NoteEvent, ParamPoint};
use crate::instruments::{INSTRUMENT_COUNT, INSTRUMENT_NAME_HASHES};

/// Returned by `untzel_instance_create` when the instrument id is unknown.
pub const NO_SLOT: u32 = u32::MAX;
/// Queue push results.
pub const PUSH_OK: u32 = 0;
pub const PUSH_QUEUE_FULL: u32 = 1;
/// Results of the functions added with the instrument library.
pub const APPLIED: u32 = 0;
pub const REFUSED: u32 = 1;

fn applied(ok: bool) -> u32 {
    if ok { APPLIED } else { REFUSED }
}

/// `untzel_engine_new` results.
pub const ENGINE_OK: u32 = 0;
pub const ENGINE_REJECTED: u32 = 1;

thread_local! {
    static ENGINE: RefCell<Option<Engine>> = const { RefCell::new(None) };
}

/// Runs `action` on the engine, or returns `fallback` before `untzel_engine_new`.
pub(crate) fn with_engine<T>(fallback: T, action: impl FnOnce(&mut Engine) -> T) -> T {
    ENGINE.with_borrow_mut(|engine| engine.as_mut().map_or(fallback, action))
}

fn push_result<E>(result: Result<(), E>) -> u32 {
    if result.is_ok() {
        PUSH_OK
    } else {
        PUSH_QUEUE_FULL
    }
}

/// Byte offset of a pointer in the WASM linear memory (32-bit addresses).
fn offset<T>(pointer: *const T) -> u32 {
    pointer as usize as u32
}

/// Creates the engine and pre-allocates every bus. 0 ok, 1 already created or invalid
/// sample rate. Allocates; constructor only.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_engine_new(sample_rate: f32) -> u32 {
    ENGINE.with_borrow_mut(|engine| {
        if engine.is_some() {
            return ENGINE_REJECTED;
        }
        *engine = Engine::new(sample_rate);
        if engine.is_some() {
            ENGINE_OK
        } else {
            ENGINE_REJECTED
        }
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn untzel_instrument_count() -> u32 {
    INSTRUMENT_COUNT as u32
}

/// fnv1a32 of the instrument name, or 0 for an unknown id.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_instrument_name_hash(id: u32) -> u32 {
    INSTRUMENT_NAME_HASHES
        .get(id as usize)
        .copied()
        .unwrap_or(0)
}

/// New `Pending` slot, or `NO_SLOT`. Allocates; message handler only.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_instance_create(instrument_id: u32) -> u32 {
    with_engine(NO_SLOT, |engine| {
        engine.instance_create(instrument_id).unwrap_or(NO_SLOT)
    })
}

/// Initial value of a parameter, no ramp.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_param_set(slot: u32, param: u32, value: f32) {
    with_engine((), |engine| engine.param_set(slot, param, value));
}

#[unsafe(no_mangle)]
pub extern "C" fn untzel_instance_activate(slot: u32, at_frame: f64) {
    with_engine((), |engine| engine.instance_activate(slot, at_frame));
}

/// From `at_frame` the slot takes no events and finishes its tail.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_instance_retire(slot: u32, at_frame: f64) {
    with_engine((), |engine| engine.instance_retire(slot, at_frame));
}

/// Frees `Finished` slots; returns how many. Message handler only.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_collect() -> u32 {
    with_engine(0, Engine::collect)
}

/// `note` is midi, or -1 for a hit. `PUSH_OK` or `PUSH_QUEUE_FULL`.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_event_push(
    slot: u32,
    frame: f64,
    duration: f64,
    note: f32,
    velocity: f32,
) -> u32 {
    let event = NoteEvent {
        slot,
        frame,
        duration,
        note,
        velocity,
    };
    with_engine(PUSH_OK, |engine| push_result(engine.event_push(event)))
}

/// Ramp of `ramp` frames from the current value to `value`, starting at `frame`.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_param_push(
    slot: u32,
    param: u32,
    frame: f64,
    value: f32,
    ramp: u32,
) -> u32 {
    let point = ParamPoint {
        slot,
        frame,
        param,
        value,
        ramp,
    };
    with_engine(PUSH_OK, |engine| push_result(engine.param_push(point)))
}

/// Updates the delay line lengths (20 ms ramp on the read position).
#[unsafe(no_mangle)]
pub extern "C" fn untzel_tempo(bpm: f64, at_frame: f64) {
    with_engine((), |engine| engine.tempo(bpm, at_frame));
}

/// 20 ms ramp.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_master_gain(value: f32) {
    with_engine((), |engine| engine.master_gain(value));
}

/// Drops future events, ramps the master to zero in 20 ms, then clears voices and buses
/// in chunks.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_stop(at_frame: f64) {
    with_engine((), |engine| engine.stop(at_frame));
}

/// Renders `frames` (<= 128) starting at `frame` into the output buffer. Never allocates.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_render(frame: f64, frames: u32) {
    with_engine((), |engine| engine.render(frame, frames as usize));
}

/// Byte offset of the planar output: 128 f32 left, then 128 f32 right.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_output_ptr() -> u32 {
    with_engine(0, |engine| offset(engine.output().as_ptr()))
}

/// Byte offset of the f64 stats block (layout in ABI.md).
#[unsafe(no_mangle)]
pub extern "C" fn untzel_stats_ptr() -> u32 {
    with_engine(0, |engine| offset(engine.stats().cells().as_ptr()))
}

/// Length of the stats block in f64 cells.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_stats_len() -> u32 {
    with_engine(0, |engine| engine.stats().cells().len() as u32)
}

/// CPU protection: at most `max_voices` voices of the slot sound (0 = no cap); voices
/// above the cap fade out in about 2 ms. 0 applied, 1 refused (unknown slot).
#[unsafe(no_mangle)]
pub extern "C" fn untzel_voice_limit(slot: u32, max_voices: u32) -> u32 {
    with_engine(REFUSED, |engine| {
        applied(engine.voice_limit(slot, max_voices))
    })
}

/// Copies `[sumSquares, frames, peak]` of the slot since the last call (after `gain`,
/// before `pan` and sends) to `untzel_levels_ptr()` and restarts the sums. 0 applied,
/// 1 refused (unknown slot).
#[unsafe(no_mangle)]
pub extern "C" fn untzel_slot_levels(slot: u32) -> u32 {
    with_engine(REFUSED, |engine| applied(engine.slot_levels(slot)))
}

/// Byte offset of the three `f64` written by `untzel_slot_levels`.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_levels_ptr() -> u32 {
    with_engine(0, |engine| offset(engine.levels().as_ptr()))
}

/// Writes effect `kind` (0 lowpass … 8 gate) at `position` 0..8 of the slot's pending
/// order. 0 applied, 1 refused.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_effect_order(slot: u32, position: u32, kind: u32) -> u32 {
    with_engine(REFUSED, |engine| {
        applied(engine.effect_order(slot, position, kind))
    })
}

/// The first `count` (0..9) pending effects become the chain at `at_frame`, with a 40 ms
/// crossfade through dry. A repeated kind refuses the whole commit.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_effects_commit(slot: u32, count: u32, at_frame: f64) -> u32 {
    with_engine(REFUSED, |engine| {
        applied(engine.effects_commit(slot, count, at_frame))
    })
}

/// A fast LFO (`shape` 0 sine, 1 triangle, 2 saw, 3 square; `curve` 0 linear, 1
/// exponential) on `param`. 0 applied, 1 refused.
#[unsafe(no_mangle)]
#[allow(clippy::too_many_arguments)]
pub extern "C" fn untzel_modulator_set(
    slot: u32,
    param: u32,
    shape: u32,
    curve: u32,
    period_frames: f64,
    origin_frame: f64,
    low: f32,
    high: f32,
) -> u32 {
    with_engine(REFUSED, |engine| {
        applied(engine.modulator_set(
            slot,
            param,
            shape,
            curve,
            period_frames,
            origin_frame,
            low,
            high,
        ))
    })
}

/// A per-note envelope on `param`: jumps to `from` on every note and reaches `to` (99%)
/// in `seconds`. 0 applied, 1 refused.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_envelope_set(
    slot: u32,
    param: u32,
    curve: u32,
    seconds: f32,
    from: f32,
    to: f32,
) -> u32 {
    with_engine(REFUSED, |engine| {
        applied(engine.envelope_set(slot, param, curve, seconds, from, to))
    })
}

/// `param` obeys `untzel_param_set`/`untzel_param_push` again. 0 applied, 1 refused.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_modulator_clear(slot: u32, param: u32) -> u32 {
    with_engine(REFUSED, |engine| {
        applied(engine.modulator_clear(slot, param))
    })
}

/// Native tests only: runs `action` on this thread's engine (the ABI's pointers are
/// meaningless outside the WASM memory).
#[cfg(not(target_arch = "wasm32"))]
pub fn with_engine_for_tests<T>(action: impl FnOnce(&mut Engine) -> T) -> Option<T> {
    ENGINE.with_borrow_mut(|engine| engine.as_mut().map(action))
}
