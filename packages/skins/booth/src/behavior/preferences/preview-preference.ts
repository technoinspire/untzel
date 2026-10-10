// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { PreferenceStore } from "./collapse";

// "Preview sounds": every touched note sounds unless the person
// turns it off for silent editing. Saved on the device, on by default; not music, so
// never in the text or the link.

export const PREVIEW_SOUNDS_KEY = "untzel.preview.sounds";

export function readPreviewSounds(store: PreferenceStore | null): boolean {
  try {
    return store?.getItem(PREVIEW_SOUNDS_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Best effort: a full or blocked storage only loses the preference for later visits. */
export function writePreviewSounds(store: PreferenceStore | null, isOn: boolean): void {
  try {
    store?.setItem(PREVIEW_SOUNDS_KEY, String(isOn));
  } catch {
    // The switch still works for this visit.
  }
}
