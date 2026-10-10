// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Rational } from "./rational";

/** Half-open span [begin, end), in bars. */
export interface TimeSpan {
  readonly begin: Rational;
  readonly end: Rational;
}
