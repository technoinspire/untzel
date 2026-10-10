// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { barsChoice, exportRangeOf, isSameFollowedRange, orderedParts, partsWithin, requestKey } from "./export-request";

describe("export request", () => {
  it("offers 8, 16, 32 and 64 bars, 16 otherwise", () => {
    expect([8, 16, 32, 64, 12, 0].map(barsChoice)).toEqual([8, 16, 32, 64, 16, 16]);
  });

  it("orders From and To and keeps them within the song", () => {
    expect(orderedParts({ from: 3, to: 1 })).toEqual({ from: 1, to: 3 });
    expect(partsWithin(null, 4)).toEqual({ from: 0, to: 3 });
    expect(partsWithin({ from: 2, to: 5 }, 3)).toEqual({ from: 2, to: 2 });
    expect(partsWithin(null, 0)).toEqual({ from: 0, to: 0 });
  });

  it("the story has no range, a loop range has bars, a song range has parts", () => {
    const parts = { from: 1, to: 2 };
    expect(exportRangeOf({ format: "story", mode: "song", bars: 16, parts, stretch: null })).toBeNull();
    expect(exportRangeOf({ format: "video", mode: "loop", bars: 32, parts, stretch: null })).toEqual({ kind: "bars", bars: 32 });
    expect(exportRangeOf({ format: "audio", mode: "song", bars: 32, parts, stretch: null })).toEqual({ kind: "song", fromPart: 1, toPart: 2 });
  });

  it("a chosen stretch is the range of every format, the story included", () => {
    const stretch = { startTick: 552, endTick: 1792 };
    expect(exportRangeOf({ format: "audio", mode: "loop", bars: 16, parts: { from: 0, to: 0 }, stretch })).toEqual({ kind: "span", startTick: 552, endTick: 1792 });
    expect(exportRangeOf({ format: "story", mode: "loop", bars: 16, parts: { from: 0, to: 0 }, stretch })).toEqual({ kind: "span", startTick: 552, endTick: 1792 });
  });

  it("the key changes with the text, format, quality, mode and range, and has no position in it", () => {
    const request = { sourceHash: 7, format: "video", quality: "hd", mode: "loop", range: { kind: "bars", bars: 16 } } as const;
    const base = requestKey(request);
    expect(base).toBe("7|video|hd|loop|bars 16");
    expect(requestKey({ ...request, sourceHash: 8 })).not.toBe(base);
    expect(requestKey({ ...request, quality: "4k" })).not.toBe(base);
    expect(requestKey({ ...request, format: "audio" })).not.toBe(base);
    expect(requestKey({ ...request, mode: "song", range: { kind: "song", fromPart: 0, toPart: 1 } })).toBe("7|video|hd|song|parts 0-1");
    expect(requestKey({ ...request, range: { kind: "span", startTick: 552, endTick: 1792 } })).toBe("7|video|hd|loop|span 552-1792");
    expect(requestKey({ ...request, format: "story", range: null })).toBe("7|story|hd|loop|story");
  });

  it("gives audio one key whatever quality the picture formats hold", () => {
    const audio = { sourceHash: 7, format: "audio", mode: "loop", range: { kind: "bars", bars: 16 } } as const;
    expect(requestKey({ ...audio, quality: "hd" })).toBe(requestKey({ ...audio, quality: "4k" }));
  });
  it("a followed range is the same with the same mode and bars, or when both are cleared", () => {
    const range = { mode: "loop" as const, startBar: 9, endBar: 28, label: "Bars 9–28" };
    expect(isSameFollowedRange(range, { ...range, label: "other words" })).toBe(true);
    expect(isSameFollowedRange(range, { ...range, endBar: 24 })).toBe(false);
    expect(isSameFollowedRange(range, { ...range, mode: "song" })).toBe(false);
    expect(isSameFollowedRange(null, null)).toBe(true);
    expect(isSameFollowedRange(range, null)).toBe(false);
  });
});
