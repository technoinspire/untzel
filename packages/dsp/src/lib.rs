// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Untzel DSP engine. Compiled for `wasm32-unknown-unknown` with a raw C ABI that
//! imports nothing (no wasm-bindgen: its glue needs globals the AudioWorklet scope lacks).
//! The ABI is specified in `ABI.md`; `abi.rs` implements it over `engine::Engine`.

pub mod abi;
pub mod engine;
pub mod engines;
pub mod events;
pub mod fx;
pub mod math;
pub mod mix;
pub mod modulation;
pub mod params;
pub mod pool;
pub mod samples;
pub mod slot;
pub mod stats;
pub mod voice;

/// Generated from `instruments/*/manifest.json` by `build.rs`, sorted by name; the
/// position in `INSTRUMENT_NAMES` is the instrumentId.
pub mod instruments {
    include!(concat!(env!("OUT_DIR"), "/instruments.rs"));
}
