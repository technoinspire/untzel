// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { chooseTiers, type DeviceProbe, type ExportPlan } from "@untzel/export";
import type { Program } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { withinProbe } from "./export-probe";
import type { RenderJob } from "./export-render-request";

const job = (quality: "hd" | "4k"): RenderJob => ({
  kind: "render",
  key: quality,
  plan: { quality } as unknown as ExportPlan,
  program: {} as Program,
  title: { text: "Song", fileStem: "song" } as RenderJob["title"],
});
const probe = (fourKFramesPerSecond: number | null, isSupported = true): DeviceProbe =>
  ({
    tiers: [
      { quality: "hd", isSupported: true, framesPerSecond: 120 },
      { quality: "4k", isSupported, framesPerSecond: fourKFramesPerSecond },
    ],
  }) as unknown as DeviceProbe;
const api = { chooseTiers };

describe("withinProbe (4K picked before the first probe)", () => {
  const fourK = { ...job("4k"), fallback: job("hd") };

  it("renders 4K when the probe offers it", () => {
    expect(withinProbe(api, fourK, probe(33)).key).toBe("4k");
  });

  it("renders HD when the device cannot take 4K at real time, or has no 4K codec", () => {
    expect(withinProbe(api, fourK, probe(8)).key).toBe("hd");
    expect(withinProbe(api, fourK, probe(null, false)).key).toBe("hd");
  });

  it("renders HD when the probe did not finish", () => {
    expect(withinProbe(api, fourK, null).key).toBe("hd");
  });

  it("leaves a job without a fallback alone", () => {
    const hd = { ...job("hd"), fallback: null };
    expect(withinProbe(api, hd, null)).toBe(hd);
  });
});
