// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { packetBudget } from "./packet-budget";

describe("packetBudget", () => {
  it("is one packet per video frame", () => {
    expect(packetBudget({ totalVideoFrames: 497 }).video).toBe(497);
  });

  it("covers AAC (1 024 samples) and Opus (960) with room to spare", () => {
    // 4:15 + 2 s at 30 fps.
    const totalVideoFrames = 7_710;
    const samples = totalVideoFrames * 1_600;
    const { audio } = packetBudget({ totalVideoFrames });
    expect(audio).toBe(Math.ceil(samples / 480) + 64);
    expect(audio).toBeGreaterThan(2 * Math.ceil(samples / 960));
    expect(audio).toBeGreaterThan(2 * Math.ceil(samples / 1_024));
  });
});
