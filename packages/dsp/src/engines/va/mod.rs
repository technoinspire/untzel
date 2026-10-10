// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Virtual analog: up to seven band-limited oscillators (polyBLEP saw and pulse,
//! triangle, sine) spread in a detune fan, a sub oscillator and noise, through a 12 dB
//! state-variable (low, band, high) or a 24 dB ladder filter, with amplitude and filter
//! envelopes, glide and a stereo fan, and an analog wander.
//! `VaCore` is the whole voice; instruments choose a `VaPatch` and map their parameters
//! onto `VaControls` once per block.

mod controls;
mod core;
mod fan;
mod filter;
mod ladder;
mod oscillator;
mod wander;

pub use controls::{FilterKind, FilterMode, VaControls, VaPatch, VaShape, VaShapeParams};
pub use core::VaCore;
pub use fan::MAX_OSCILLATORS;
pub use ladder::Ladder;
pub use oscillator::{Oscillator, Wave};
