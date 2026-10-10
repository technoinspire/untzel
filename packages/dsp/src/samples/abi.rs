// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The sample-pack functions of the ABI (`ABI.md`, "Sample packs"). Same rules as the
//! rest of `abi.rs`: only numbers cross, nothing is imported, every function here runs
//! in the message handler.

use crate::abi::{APPLIED, REFUSED, with_engine};

fn applied(ok: bool) -> u32 {
    if ok { APPLIED } else { REFUSED }
}

/// Allocates a pack of `frames` 16-bit samples at `sample_rate` and `zones` zones for
/// `instrument_id`. 0 applied, 1 refused. Allocates; memory may grow.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_samples_reserve(
    instrument_id: u32,
    frames: u32,
    zones: u32,
    sample_rate: f32,
) -> u32 {
    with_engine(REFUSED, |engine| {
        applied(
            engine
                .samples_mut()
                .reserve(instrument_id, frames, zones, sample_rate),
        )
    })
}

/// Byte offset of the reserved PCM (`frames` i16), or 0 without a reserve.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_samples_pcm_ptr() -> u32 {
    with_engine(0, |engine| {
        engine
            .samples_mut()
            .upload_mut()
            .map_or(0, |(pcm, _)| pcm.as_ptr() as usize as u32)
    })
}

/// Byte offset of the reserved zone table (`zones` × 8 f64), or 0 without a reserve.
#[unsafe(no_mangle)]
pub extern "C" fn untzel_samples_zones_ptr() -> u32 {
    with_engine(0, |engine| {
        engine
            .samples_mut()
            .upload_mut()
            .map_or(0, |(_, zones)| zones.as_ptr() as usize as u32)
    })
}

/// Checks the zones and makes the upload the instrument's pack from `at_frame`: notes
/// that start at or after it play the samples. 0 applied, 1 refused (upload dropped).
#[unsafe(no_mangle)]
pub extern "C" fn untzel_samples_commit(at_frame: f64) -> u32 {
    with_engine(REFUSED, |engine| {
        applied(engine.samples_mut().commit(at_frame))
    })
}
