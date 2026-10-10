// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { deviceKey, parseProbe, serializeProbe, type DeviceTraits } from "./probe-cache";

describe("probe cache", () => {
  const traits: DeviceTraits = { userAgent: "Chrome/154", cores: 10, memoryGb: 8, screenWidth: 1512, screenHeight: 982, pixelRatio: 2 };
  const probe = { tiers: [{ quality: "hd" as const, isSupported: true, framesPerSecond: 88.5 }] };

  it("reads back what it wrote for the same device", () => {
    const key = deviceKey(traits);
    expect(parseProbe(serializeProbe(probe, key), key)).toEqual(probe);
  });

  it("probes again on another device, a rotated screen aside", () => {
    const key = deviceKey(traits);
    expect(deviceKey({ ...traits, screenWidth: 982, screenHeight: 1512 })).toBe(key);
    expect(parseProbe(serializeProbe(probe, key), deviceKey({ ...traits, userAgent: "Chrome/155" }))).toBeNull();
    expect(parseProbe(serializeProbe(probe, key), deviceKey({ ...traits, memoryGb: null }))).toBeNull();
  });

  it("refuses a damaged or foreign value instead of trusting it", () => {
    const key = deviceKey(traits);
    for (const text of [null, "", "{", "[]", JSON.stringify({ version: 2, key, tiers: [] })]) expect(parseProbe(text, key)).toBeNull();
    const bad = JSON.stringify({ version: 1, key, tiers: [{ quality: "8k", isSupported: true, framesPerSecond: 1 }] });
    expect(parseProbe(bad, key)).toBeNull();
    const negative = JSON.stringify({ version: 1, key, tiers: [{ quality: "hd", isSupported: true, framesPerSecond: -1 }] });
    expect(parseProbe(negative, key)).toBeNull();
  });
});
