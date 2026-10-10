// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { brandExclusionZones, exportKeepOut } from "@untzel/export/brand-exclusion";
import { screenKeepOut, type KeepOut } from "@untzel/scene";
// The regions the scene keeps dark on the page: every export format's brand zone,
// read from the export's own brandLayout, and the top bar's band. The export worker
// computes the same list, so the screen and the video leave the same places empty.

let cached: KeepOut | null = null;

export function stageKeepOut(): KeepOut {
  cached ??= screenKeepOut(brandExclusionZones());
  return cached;
}
/** An exported file's keep-out, the worker's own, for the Export sheet's still. */
export function stillKeepOut(): KeepOut {
  return exportKeepOut();
}
