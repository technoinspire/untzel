// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { StageBox } from "./renderer";
// The shape of the dark regions, shared by the WebGL2 shader and the 2D level.
// A brand zone is dark inside the ellipse through its box's corners and fades out over the
// mask's feather, measured as a distance from that ellipse. A box with a soft edge still
// read as a dark rectangle on the wide live stage; an ellipse has no
// straight edge. Pure numbers and a CPU mirror of the shader for the tests.

/** The masks' soft edge, in u: the brand zones fade out over it, the chrome band over 15 % of it. */
export const MASK_FEATHER = 0.3;

/** Each semi-axis over the box's side: the ellipse √2 × the half box passes through its corners. */
export const MASK_ELLIPSE_SCALE = Math.SQRT1_2;

/**
 * u: in a file the sky's haze is full at the chrome line and fades out this far under it,
 * into the scene's own sky, so the light has no seam there.
 */
export const SKY_OVERLAP_U = 0.2;

export interface ZoneEllipse {
  readonly centerX: number;
  readonly centerY: number;
  readonly radiusX: number;
  readonly radiusY: number;
}

export function zoneEllipse(box: StageBox): ZoneEllipse {
  return {
    centerX: (box.minX + box.maxX) / 2,
    centerY: (box.minY + box.maxY) / 2,
    radiusX: (box.maxX - box.minX) * MASK_ELLIPSE_SCALE,
    radiusY: (box.maxY - box.minY) * MASK_ELLIPSE_SCALE,
  };
}

/** The first-order distance from the ellipse (its value over its gradient); ≤ 0 inside. */
export function ellipseDistance(x: number, y: number, ellipse: ZoneEllipse): number {
  const qx = (x - ellipse.centerX) / ellipse.radiusX;
  const qy = (y - ellipse.centerY) / ellipse.radiusY;
  const r = Math.hypot(qx, qy);
  const slope = Math.hypot(qx / ellipse.radiusX, qy / ellipse.radiusY) / Math.max(r, 1e-6);
  return (r - 1) / Math.max(slope, 1e-6);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** How much light a brand zone keeps at a point: 0 inside its ellipse, 1 past the feather. */
export function brandKeepAt(x: number, y: number, boxes: readonly StageBox[], feather: number): number {
  return boxes.reduce((keep, box) => keep * smoothstep(0, feather, ellipseDistance(x, y, zoneEllipse(box))), 1);
}

/**
 * The 2D level's feather as `steps` rings of the stage colour, outermost first: ring i
 * grows the ellipse by `offset` and covers with `alpha`, so that the light left in each
 * band is the shader's smoothstep at the band's middle.
 */
export function featherRings(feather: number, steps: number): readonly { readonly offset: number; readonly alpha: number }[] {
  const kept = (band: number) => smoothstep(0, feather, ((band - 0.5) * feather) / steps);
  return Array.from({ length: steps }, (_, index) => {
    const band = steps - index;
    const outer = band === steps ? 1 : kept(band + 1);
    return { offset: (band * feather) / steps, alpha: 1 - kept(band) / outer };
  });
}
