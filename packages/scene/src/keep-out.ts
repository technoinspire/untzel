// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The regions of the composition square that stay dark on every surface. The
// scene does not know the brand: @untzel/export computes the brand zones from its own
// brandLayout and the composition root hands the same list to the stage and to the export.

/** A box in composition units (u), y down. */
export interface ExclusionBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface KeepOut {
  /** Each export format's brand veil plus a margin: dark on screen and in the video. */
  readonly brandZones: readonly ExclusionBox[];
  /** No scene primitive is placed above this line: the top bar covers it on screen. */
  readonly topY: number;
  /**
   * True on the page, where the top bar covers the band above topY; false in an exported
   * file, which has no chrome. Placement, seeds, palette
   * and figures never read it, and the top mask stays in both: only the sky's atmosphere,
   * drawn after the mask, reads it.
   */
  readonly frameHasChrome: boolean;
}

/**
 * The top bar (logo, Share, Export) reaches y = −0.79 u on the desktop stage and
 * −0.84 u on the phone; the larger of the two plus 0.01 of room.
 */
export const TOP_CHROME_KEEP_OUT_Y = -0.78;

/** The page's keep-out: the top bar's band stays dark. */
export function screenKeepOut(brandZones: readonly ExclusionBox[]): KeepOut {
  return { brandZones, topY: TOP_CHROME_KEEP_OUT_Y, frameHasChrome: true };
}

/** An exported frame's keep-out: the same placement, and no chrome over the top band. */
export function fileKeepOut(brandZones: readonly ExclusionBox[]): KeepOut {
  return { brandZones, topY: TOP_CHROME_KEEP_OUT_Y, frameHasChrome: false };
}

/**
 * Where the sky's atmosphere may extend, in u: everything above the chrome line in a file,
 * the band a screen gives to its top bar (or does not have, in a frame taller than the
 * stage). Null on a screen, so the page draws exactly what it drew before.
 */
export function skyAtmosphereLine(keepOut: KeepOut): number | null {
  return keepOut.frameHasChrome ? null : keepOut.topY;
}

export function overlapsBox(a: ExclusionBox, b: ExclusionBox): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/** Distance from a point to a box, 0 inside. */
export function distanceToBox(x: number, y: number, box: ExclusionBox): number {
  const dx = Math.max(box.minX - x, 0, x - box.maxX);
  const dy = Math.max(box.minY - y, 0, y - box.maxY);
  return Math.hypot(dx, dy);
}
