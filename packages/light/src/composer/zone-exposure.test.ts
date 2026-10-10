// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { AreaKind, FigureKind, MAX_AREAS, type ScenePrimitive } from "./scene-primitive";
import { EXPOSURE_SLIDE_S, capAreas, countByZone, mergeCoincident, zoneScale, zoneScaleAt } from "./zone-exposure";

function primitive(layer: "area" | "figure", intensity: number, zone: ScenePrimitive["zone"], seed = 0): ScenePrimitive {
  const shared = { x: 0, y: 0, size: 0.2, width: 0.01, aspect: 1, rotation: 0, extra: 0, intensity, color: 0, whiteCore: false, flow: 0, seed, zone, isTransient: true };
  return layer === "area" ? { ...shared, layer, kind: AreaKind.Glow } : { ...shared, layer, kind: FigureKind.Ring };
}

describe("zone exposure", () => {
  it("lights a zone of n full layers at min(1, 1.5 / √n)", () => {
    expect(zoneScale(0)).toBe(1);
    expect(zoneScale(2)).toBe(1);
    expect(zoneScale(4)).toBeCloseTo(0.75, 12);
    expect(zoneScale(9)).toBeCloseTo(0.5, 12);
  });

  it("slides from the bar before's scale over 0.35 s, continuously", () => {
    expect(zoneScaleAt(1, 0.5, 0)).toBe(1);
    expect(zoneScaleAt(1, 0.5, EXPOSURE_SLIDE_S / 2)).toBeCloseTo(0.75, 12);
    expect(zoneScaleAt(1, 0.5, EXPOSURE_SLIDE_S)).toBe(0.5);
    expect(zoneScaleAt(1, 0.5, 10)).toBe(0.5);
    for (let t = 0; t < EXPOSURE_SLIDE_S; t += 0.001) expect(Math.abs(zoneScaleAt(1, 0.5, t + 0.001) - zoneScaleAt(1, 0.5, t))).toBeLessThan(0.002);
  });

  it("holds each zone's area light to 1 and keeps the 64 strongest areas, never touching figures", () => {
    const many = Array.from({ length: 80 }, (_, index) => primitive("area", 0.1 + index / 1000, index % 2 === 0 ? "core" : "sky", index));
    const figures = Array.from({ length: 10 }, (_, index) => primitive("figure", 0.9, "core", index));
    const capped = capAreas([...many, ...figures]);
    const areas = capped.filter((item) => item.layer === "area");
    expect(areas.length).toBe(MAX_AREAS);
    for (const zone of ["core", "sky"] as const) {
      const sum = areas.filter((item) => item.zone === zone).reduce((total, item) => total + item.intensity, 0);
      expect(sum).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(capped.filter((item) => item.layer === "figure")).toEqual(figures);
  });

  it("counts zones and merges coincident pulses into the strongest", () => {
    expect(countByZone(["core", "sky", "core"])).toEqual(new Map([["core", 2], ["sky", 1]]));
    const merged = mergeCoincident([
      { audioTime: 1, velocity: 0.4 },
      { audioTime: 1, velocity: 0.9 },
      { audioTime: 2, velocity: 0.5 },
    ]);
    expect(merged).toEqual([
      { audioTime: 1, velocity: 0.9 },
      { audioTime: 2, velocity: 0.5 },
    ]);
  });
});
