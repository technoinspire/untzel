// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { liftFor } from "./keyboard-lift";

describe("keyboard lift", () => {
  it("raises the command line only when the keyboard covers it", () => {
    expect(liftFor(700, 500)).toBe(208);
    expect(liftFor(400, 500)).toBe(0);
  });
});
