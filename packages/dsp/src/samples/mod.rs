// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Sample packs of the engine (`vox`, `choir`): the library that receives and
//! schedules them, and its ABI. The voices read a pack through
//! `engines::sampler::SamplePack`; nothing here runs per sample.

pub mod abi;
pub mod library;

pub use library::SampleLibrary;
