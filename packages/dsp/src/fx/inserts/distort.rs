// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! `distort`: the soft saturation of `math`, with a gain that keeps the loudness close
//! to the dry signal as the drive rises.

use crate::math::saturate;

const DEPTH: f32 = 12.0;

#[inline]
pub fn distort(input: [f32; 2], amount: f32) -> [f32; 2] {
    let amount = amount.clamp(0.0, 1.0);
    // Saturation raises the RMS of quiet material; pull it back a little.
    let compensation = 1.0 / (1.0 + 0.6 * amount);
    [
        saturate(input[0], amount, DEPTH) * compensation,
        saturate(input[1], amount, DEPTH) * compensation,
    ]
}
