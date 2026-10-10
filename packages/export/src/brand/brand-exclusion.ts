// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { fileKeepOut, type ExclusionBox, type KeepOut } from "@untzel/scene";
import { stageToSquare } from "@untzel/light/offline";
import { brandLayout } from "./brand-layout";
import { QUALITIES, VIDEO_FORMATS, frameSize, type FrameSize } from "../probe/tiers";
// The brand zones of the scene: every export format's mark veil plus 0.04 u, in
// composition units. One source, the brandLayout the frames are drawn with: the composition
// root hands this list to the live stage and the export worker computes it again, so the
// screen and the video keep the same regions dark. HD and 4K give the same box.

export const BRAND_EXCLUSION_MARGIN = 0.04;
/** Two boxes closer than this are one (HD and 4K round a pixel apart). */
const SAME_BOX = 1e-3;

/** An exported frame's keep-out: the page's zones, and no top bar. */
export function exportKeepOut(): KeepOut {
  return fileKeepOut(brandExclusionZones());
}

export function brandExclusionZones(): readonly ExclusionBox[] {
  const zones: ExclusionBox[] = [];
  for (const format of VIDEO_FORMATS) {
    for (const quality of QUALITIES) {
      const size = frameSize(format, quality);
      const zone = grow(veilInSquare(size), BRAND_EXCLUSION_MARGIN);
      if (!zones.some((kept) => isSameBox(kept, zone))) zones.push(zone);
    }
  }
  return zones;
}

/** The mark's veil (its scrim) of a frame, in u. */
export function veilInSquare(size: FrameSize): ExclusionBox {
  const { scrim } = brandLayout(size).mark;
  const topLeft = stageToSquare(scrim.x, scrim.y, size);
  const bottomRight = stageToSquare(scrim.x + scrim.w, scrim.y + scrim.h, size);
  return { minX: topLeft.x, maxX: bottomRight.x, minY: topLeft.y, maxY: bottomRight.y };
}

function grow(box: ExclusionBox, margin: number): ExclusionBox {
  return { minX: box.minX - margin, maxX: box.maxX + margin, minY: box.minY - margin, maxY: box.maxY + margin };
}

function isSameBox(a: ExclusionBox, b: ExclusionBox): boolean {
  return Math.abs(a.minX - b.minX) < SAME_BOX && Math.abs(a.maxX - b.maxX) < SAME_BOX && Math.abs(a.minY - b.minY) < SAME_BOX && Math.abs(a.maxY - b.maxY) < SAME_BOX;
}
