// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { DESIGN_RADIUS, SAFE_MARGIN, fitScene, placeOnStage, sceneSquare, stageToSquare, type StageSize } from "./scene-fit";

const STAGES: readonly StageSize[] = [
  { width: 960, height: 430 },
  { width: 390, height: 352 },
  { width: 1920, height: 1080 },
  { width: 1080, height: 1920 },
  { width: 3840, height: 2160 },
];

describe("fitScene", () => {
  it("sizes the scene by the shorter side, whatever the orientation", () => {
    for (const stage of STAGES) {
      const fit = fitScene(stage);
      const designRadius = DESIGN_RADIUS * fit.scale * stage.height;
      expect(designRadius / Math.min(stage.width, stage.height)).toBeCloseTo(0.5 - SAFE_MARGIN, 9);
    }
  });

  it("guards an empty stage instead of dividing by zero", () => {
    const fit = fitScene({ width: 0, height: 0 });
    expect(Number.isFinite(fit.scale)).toBe(true);
    expect(fit.aspect).toBe(1);
  });
});

describe("the composition square", () => {
  it.each([
    [960, 430, 180.6, 2.467, 1],
    [390, 352, 147.8, 1.129, 1],
    [1920, 1080, 453.6, 1.926, 1],
    [1080, 1920, 453.6, 1, 1.926],
    [3840, 2160, 907.2, 1.926, 1],
  ])("u on %i × %i is %f px; the safe area runs to %f × %f u", (width, height, unitPixels, hx, hy) => {
    const square = sceneSquare(fitScene({ width, height }));
    expect(square.unit * height).toBeCloseTo(unitPixels, 1);
    expect(square.hx).toBeCloseTo(hx, 3);
    expect(square.hy).toBeCloseTo(hy, 3);
  });

  it("maps every length of a primitive by the same unit", () => {
    const square = sceneSquare(fitScene({ width: 1920, height: 1080 }));
    const placed = placeOnStage({ x: 0.5, y: -0.25, size: 0.1, width: 0.02, extra: 3 }, square);
    expect(placed).toEqual({ x: 0.5 * square.unit, y: -0.25 * square.unit, size: 0.1 * square.unit, width: 0.02 * square.unit, extra: 3 });
  });

  it("is the same composition at HD and 4K", () => {
    expect(sceneSquare(fitScene({ width: 3840, height: 2160 }))).toEqual(sceneSquare(fitScene({ width: 1920, height: 1080 })));
  });

  it("reads a stage pixel back in u", () => {
    const size = { width: 1920, height: 1080 };
    expect(stageToSquare(960, 540, size)).toEqual({ x: 0, y: 0 });
    expect(stageToSquare(960, 540 + 453.6, size).y).toBeCloseTo(1, 6);
  });
});
