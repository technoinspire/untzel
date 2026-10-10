// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! A voice that reaches outside what voices may use: refused by build/voice_paths.rs.

use crate::math::sine;

pub fn block_size() -> usize {
    crate::slot::BLOCK
}
