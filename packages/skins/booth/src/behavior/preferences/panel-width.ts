// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { PreferenceStore } from "./collapse";

// The width of the Code panel on the desktop:
// clamp(480px, 40vw, 720px) by default, moved by a divider between 360 px and 60 % of
// the window. Like the collapse state, a preference of this device, never music.

export const PANEL_WIDTH_STORAGE_KEY = "untzel.controls.codePanelWidth";
export const PANEL_MIN_PX = 360;
export const PANEL_MAX_RATIO = 0.6;
/** One arrow press on the divider. */
export const PANEL_STEP_PX = 16;
const DEFAULT_MIN_PX = 480;
const DEFAULT_RATIO = 0.4;
const DEFAULT_MAX_PX = 720;

export interface PanelWidthBounds {
  readonly min: number;
  readonly max: number;
}

/** 360 px to 60 % of the window; a narrow window keeps the 360. */
export function panelWidthBounds(viewport: number): PanelWidthBounds {
  return { min: PANEL_MIN_PX, max: Math.max(PANEL_MIN_PX, Math.round(viewport * PANEL_MAX_RATIO)) };
}

/** clamp(480px, 40vw, 720px), as the stylesheet's own default. */
export function defaultPanelWidth(viewport: number): number {
  return Math.round(Math.min(Math.max(viewport * DEFAULT_RATIO, DEFAULT_MIN_PX), DEFAULT_MAX_PX));
}

/** The width drawn for a wanted one (null: the default), inside the bounds of this window. */
export function panelWidthFor(wanted: number | null, viewport: number): number {
  const { min, max } = panelWidthBounds(viewport);
  return Math.round(Math.min(Math.max(wanted ?? defaultPanelWidth(viewport), min), max));
}

export function readPanelWidth(store: PreferenceStore | null): number | null {
  try {
    const value = Number.parseInt(store?.getItem(PANEL_WIDTH_STORAGE_KEY) ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** null goes back to the default. Best effort, as writeCollapsed. */
export function writePanelWidth(store: PreferenceStore | null, width: number | null): void {
  try {
    store?.setItem(PANEL_WIDTH_STORAGE_KEY, width === null ? "" : String(Math.round(width)));
  } catch {
    // The divider still works for this visit.
  }
}
