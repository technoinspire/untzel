// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { ZONE_CELLS, readPackManifest, samplePackData } from "./samples";

const zone = { vowel: "aah", position: 0, lowest: 0, highest: 127, root: 60, start: 1, loopStart: 2, loopEnd: 6, pan: -0.5, singers: [] };
const pack = { format: 1, instrument: "choir", sampleRate: 48_000, frames: 8, zones: [zone, { ...zone, position: 1, pan: 0.5 }] };

describe("sample pack manifests", () => {
  it("reads the zones and turns decoded audio into the DSP tables", () => {
    const read = readPackManifest(pack);
    if (!read.ok) throw new Error(read.reason);
    const data = samplePackData(read.manifest, 7, new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2, 0.25]));
    expect(data?.instrumentId).toBe(7);
    expect(Array.from(data?.pcm ?? [])).toEqual([0, 16_384, -16_383, 32_767, -32_767, 32_767, -32_767, 8_192]);
    expect(data?.zones.length).toBe(2 * ZONE_CELLS);
    expect(Array.from(data?.zones.subarray(ZONE_CELLS) ?? [])).toEqual([1, 0, 127, 60, 1, 2, 6, 0.5]);
  });

  it("refuses audio whose length is not the pack's: the zones would point elsewhere", () => {
    const read = readPackManifest(pack);
    if (!read.ok) throw new Error(read.reason);
    expect(samplePackData(read.manifest, 0, new Float32Array(9))).toBeNull();
  });

  it("refuses an unknown format or a malformed zone", () => {
    expect(readPackManifest({ ...pack, format: 2 }).ok).toBe(false);
    expect(readPackManifest({ ...pack, zones: [{ ...zone, root: "c4" }] }).ok).toBe(false);
    expect(readPackManifest({ ...pack, zones: [] }).ok).toBe(false);
    expect(readPackManifest(null).ok).toBe(false);
  });
});
