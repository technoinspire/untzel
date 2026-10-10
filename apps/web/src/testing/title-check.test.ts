// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { drawnBounds } from "./title-check";

function image(width: number, height: number, lit: readonly (readonly [number, number])[]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of lit) data[(y * width + x) * 4 + 2] = 7;
  return { width, height, data, colorSpace: "srgb" } as ImageData;
}

describe("drawnBounds", () => {
  it("is the smallest rectangle around every pixel that is not black", () => {
    expect(drawnBounds(image(10, 8, [[2, 3], [6, 1], [4, 5]]))).toEqual({ x: 2, y: 1, w: 5, h: 5 });
  });

  it("refuses an overlay with nothing drawn", () => {
    expect(() => drawnBounds(image(4, 4, []))).toThrow("nothing drawn");
  });
});
