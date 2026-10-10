// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Exports of untzel_dsp.wasm. Mirrors packages/dsp/ABI.md, src/abi.rs and
// src/samples/abi.rs exactly; they change together. Only numbers cross the boundary; the module imports nothing.
// Frames are f64 (exact integers up to 2^53); slots, ids and indices are u32.

export interface DspExports {
  readonly memory: WebAssembly.Memory;
  /** 0 ok, 1 already created or invalid sample rate. Allocates. */
  untzel_engine_new(sampleRate: number): number;
  untzel_instrument_count(): number;
  untzel_instrument_name_hash(id: number): number;
  /** Slot index, or 0xFFFFFFFF (u32::MAX, read as -1 through the JS i32 view) when id is unknown. */
  untzel_instance_create(instrumentId: number): number;
  untzel_param_set(slot: number, param: number, value: number): void;
  untzel_instance_activate(slot: number, atFrame: number): void;
  untzel_instance_retire(slot: number, atFrame: number): void;
  /** Number of finished slots freed. */
  untzel_collect(): number;
  /** 0 ok, 1 queue full. */
  untzel_event_push(
    slot: number,
    frame: number,
    duration: number,
    note: number,
    velocity: number,
  ): number;
  /** 0 ok, 1 queue full. */
  untzel_param_push(slot: number, param: number, frame: number, value: number, ramp: number): number;
  untzel_tempo(bpm: number, atFrame: number): void;
  untzel_master_gain(value: number): void;
  untzel_stop(atFrame: number): void;
  /** Never allocates. frames <= 128. */
  untzel_render(frame: number, frames: number): void;
  /** Byte offset of 2 x 128 f32, planar: left[0..128), right[0..128). */
  untzel_output_ptr(): number;
  /** Byte offset of the f64 stats block (layout in ABI.md). */
  untzel_stats_ptr(): number;
  /** Length of the stats block in f64 cells. */
  untzel_stats_len(): number;
  /** CPU protection: at most maxVoices voices sound (0 = no cap). 0 applied, 1 refused. */
  untzel_voice_limit(slot: number, maxVoices: number): number;
  /** Copies [sumSquares, frames, peak] since the last call to untzel_levels_ptr(). 0/1. */
  untzel_slot_levels(slot: number): number;
  /** Byte offset of the 3 f64 written by untzel_slot_levels. */
  untzel_levels_ptr(): number;
  /** Effect kind 0..8 at position 0..8 of the pending order. 0 applied, 1 refused. */
  untzel_effect_order(slot: number, position: number, kind: number): number;
  /** The first count pending effects become the chain at atFrame. 0 applied, 1 refused. */
  untzel_effects_commit(slot: number, count: number, atFrame: number): number;
  /** Fast LFO on param. 0 applied, 1 refused. */
  untzel_modulator_set(
    slot: number,
    param: number,
    shape: number,
    curve: number,
    periodFrames: number,
    originFrame: number,
    low: number,
    high: number,
  ): number;
  /** Per-note envelope on param. 0 applied, 1 refused. */
  untzel_envelope_set(
    slot: number,
    param: number,
    curve: number,
    seconds: number,
    from: number,
    to: number,
  ): number;
  /** param obeys param_set/param_push again. 0 applied, 1 refused. */
  untzel_modulator_clear(slot: number, param: number): number;
  /** Allocates a sample pack (frames i16, zones × 8 f64) for instrumentId. 0 applied, 1 refused. Allocates. */
  untzel_samples_reserve(instrumentId: number, frames: number, zones: number, sampleRate: number): number;
  /** Byte offset of the reserved i16 PCM, 0 without a reserve. */
  untzel_samples_pcm_ptr(): number;
  /** Byte offset of the reserved f64 zone table, 0 without a reserve. */
  untzel_samples_zones_ptr(): number;
  /** The upload becomes the instrument's pack from atFrame. 0 applied, 1 refused (dropped). */
  untzel_samples_commit(atFrame: number): number;
}
