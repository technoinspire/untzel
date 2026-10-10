// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Whether the editing area is hidden so the stage fills the screen.
// A view preference of this device, never part of the session: it
// is not music and does not travel in a link.

import { strings } from "../../copy/copy";

export const COLLAPSED_STORAGE_KEY = "untzel.controls.collapsed";

/** The slice of Storage the shell needs; tests pass a Map-backed one. */
export interface PreferenceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The page's localStorage, or null where reading it throws (blocked storage, sandbox). */
export function browserStore(): PreferenceStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCollapsed(store: PreferenceStore | null): boolean {
  try {
    return store?.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Best effort: a full or blocked storage only loses the preference, never the music. */
export function writeCollapsed(store: PreferenceStore | null, isCollapsed: boolean): void {
  try {
    store?.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed));
  } catch {
    // The toggle still works for this visit.
  }
}

/** The toggle names what pressing it does. */
export function collapseToggleLabel(isCollapsed: boolean): string {
  return isCollapsed ? strings.showControls : strings.hideControls;
}
