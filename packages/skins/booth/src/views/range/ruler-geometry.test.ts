// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { NEAR_HANDLES_PX, edgeGeometry, handleForPointer, sameEdges } from "./ruler-geometry";
describe("edgeGeometry", () => {
  it("places a stretch as fractions of the ruler", () => {
    expect(edgeGeometry({ start: 2, end: 6 }, 8)).toEqual({ left: 0.25, width: 0.5 });
  });
  it("reads a ruler of no bars as one bar", () => {
    expect(edgeGeometry({ start: 0, end: 1 }, 0)).toEqual({ left: 0, width: 1 });
  });
});
describe("sameEdges", () => {
  it("compares both edges", () => {
    expect(sameEdges({ start: 1, end: 3 }, { start: 1, end: 3 })).toBe(true);
    expect(sameEdges({ start: 1, end: 3 }, { start: 1, end: 4 })).toBe(false);
  });
});
describe("handleForPointer", () => {
  it("takes the handle on the pointer's side of the middle", () => {
    expect(handleForPointer(110, 100, 200, 5)).toBe("start");
    expect(handleForPointer(190, 100, 200, -5)).toBe("end");
  });
  it("with the lines close together, follows the first move", () => {
    const end = 100 + NEAR_HANDLES_PX - 1;
    expect(handleForPointer(100, 100, end, -6)).toBe("start");
    expect(handleForPointer(100, 100, end, 6)).toBe("end");
  });
});
