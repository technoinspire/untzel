// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Where the desktop project menu opens: its right edge on the Menu
// button's right edge, 12 px under it; 12 px above when it does not fit under; never
// closer than 16 px to any edge of the window. Pure, tested without the DOM.
import type { Size } from "../primitives/popover-position";
export interface MenuAnchor {
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
const GAP_PX = 12;
const EDGE_PX = 16;
export function menuPopoverPosition(anchor: MenuAnchor, popover: Size, viewport: Size): { readonly left: number; readonly top: number } {
  const wanted = anchor.right - popover.width;
  const left = Math.max(EDGE_PX, Math.min(wanted, viewport.width - EDGE_PX - popover.width));
  const below = anchor.bottom + GAP_PX;
  const fitsBelow = below + popover.height <= viewport.height - EDGE_PX;
  const top = fitsBelow ? below : Math.max(EDGE_PX, anchor.top - GAP_PX - popover.height);
  return { left: Math.round(left), top: Math.round(top) };
}
