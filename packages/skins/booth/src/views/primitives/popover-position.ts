// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Where the desktop length picker opens: under its chip, kept inside the
// window; above the chip when there is no room below. Pure, tested without the DOM.

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly bottom: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

const GAP_PX = 8;
const EDGE_PX = 16;
/** The top bar with the brand mark: a popover that opens above its button never covers it. */
export const TOP_BAR_PX = 96;

export function popoverPosition(anchor: Box, popover: Size, viewport: Size, minTop = EDGE_PX): { readonly left: number; readonly top: number } {
  const left = Math.max(EDGE_PX, Math.min(anchor.left, viewport.width - popover.width - EDGE_PX));
  const below = anchor.bottom + GAP_PX;
  const fitsBelow = below + popover.height <= viewport.height - EDGE_PX;
  const top = fitsBelow ? below : Math.max(minTop, anchor.top - GAP_PX - popover.height);
  return { left: Math.round(left), top: Math.round(top) };
}
