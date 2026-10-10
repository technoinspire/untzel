// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Limits of the language.

/** Maximum source length in UTF-16 code units (SOURCE_TOO_LONG above it). */
export const MAX_SOURCE_LENGTH = 65_536;
/** Track and section names: [a-z][a-z0-9_-]*, at most this many characters. */
export const MAX_NAME_LENGTH = 24;
export const MAX_STEPS_PER_BAR = 64;
export const MAX_BARS_PER_PATTERN = 64;
export const MAX_GROUP_DEPTH = 4;
export const MIN_REPEAT = 1;
export const MAX_REPEAT = 16;
export const MAX_SHIFT = 1024;
export const MAX_TRANSPOSE = 24;
/** 40..300 BPM, also for a section's `| tempo`. */
export const MIN_TEMPO = 40;
export const MAX_TEMPO = 300;
export const DEFAULT_TEMPO = 132;
export const MAX_SWING = 0.5;
export const MAX_SIGNAL_PERIOD = 256;
export const MIN_PART_BARS = 1;
export const MAX_PART_BARS = 256;
/** "?" without a number. */
export const DEFAULT_PROBABILITY = 0.5;
