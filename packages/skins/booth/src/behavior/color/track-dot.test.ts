// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { trackColorIndex } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { trackDotClass } from "./track-dot";

describe("track dot", () => {
  it("carries the track's palette color, stable for a name", () => {
    expect(trackDotClass("kick")).toBe(`ui-track-dot ui-track-dot--${trackColorIndex("kick")}`);
    expect(trackDotClass("bass2")).toBe(trackDotClass("bass2"));
  });
});
