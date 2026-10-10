// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import {
  fmix32,
  fnv1a32,
  mix,
  mulberry32,
  normalizeSource,
  probabilityDraw,
  randomSignalDraw,
  sourceHash,
} from "./random";

// Normative vectors of the seeded randomness. Changing one changes the sound of every shared link.
describe("seeded randomness vectors", () => {
  it("hashes with FNV-1a and finalizes with fmix32", () => {
    expect(fnv1a32("a")).toBe(0xe40c292c);
    expect(fmix32(1)).toBe(0x514e28b7);
    expect(fnv1a32("kick")).toBe(0xc61c131f);
    expect(fnv1a32("hat")).toBe(0xf2bf17c2);
    expect(fnv1a32("bass")).toBe(0x53dcb77a);
    expect(fnv1a32("h")).toBe(0xed0c3757);
    expect(fnv1a32("tempo 132\nh: hat x? x? x? x?")).toBe(0x021f863b);
  });

  it("mixes and draws", () => {
    const cases: readonly (readonly [number, number, number, number])[] = [
      [0, 0, 0xdb757017, 0.533391407],
      [0, 1, 0xdab5e45a, 0.4827682672],
      [7, 3, 0x81f427d8, 0.7615871038],
    ];
    for (const [bar, element, mixed, u] of cases) {
      expect(mix(0x021f863b, 0xed0c3757, bar, element)).toBe(mixed);
      expect(mulberry32(mixed)()).toBeCloseTo(u, 10);
      expect(probabilityDraw(0x021f863b, "h", bar, element)).toBeCloseTo(u, 10);
    }
  });

  it("generates the reference mulberry32 sequence", () => {
    const next = mulberry32(0);
    expect(next()).toBeCloseTo(0.2664292087, 10);
    expect(next()).toBeCloseTo(0.0003297457, 10);
    expect(next()).toBeCloseTo(0.2232720274, 10);
  });

  it("draws rand signals with element 0xFFFF", () => {
    const expected = mulberry32(mix(1234, fnv1a32("bass"), 5, 0xffff))();
    expect(randomSignalDraw(1234, "bass", 5)).toBe(expected);
  });
});

describe("normalizeSource", () => {
  it("drops comments, blank lines and extra spacing", () => {
    const text = "// title\r\n  tempo   132  \r\n\r\nh:\that  x? x? x? x?   // note\n\n";
    expect(normalizeSource(text)).toBe("tempo 132\nh: hat x? x? x? x?");
    expect(sourceHash(text)).toBe(0x021f863b);
  });

  it("gives the same hash to texts that differ only in formatting", () => {
    expect(sourceHash("kick x...\n")).toBe(sourceHash("  kick   x... // drums"));
    expect(sourceHash("kick x...")).not.toBe(sourceHash("kick x..x"));
  });
  it("leaves the title line out: renaming keeps every draw", () => {
    const text = "tempo 132\nh: hat x? x? x? x?";
    expect(sourceHash(`title "Midnight Coast"\n${text}`)).toBe(0x021f863b);
    expect(sourceHash(`  title   "A // b"\n${text}`)).toBe(sourceHash(text));
    expect(normalizeSource("title: kick x?")).toBe("title: kick x?");
  });
});
