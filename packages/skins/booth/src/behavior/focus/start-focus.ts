// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Where the focus goes when the music starts. The waiting screen hides with
// the control that started it, so the focus would fall to the body.

export type StartFocus = "add-track" | "play";

/**
 * The empty project opens with Add track focused. Otherwise Play takes
 * the focus the waiting screen lost; a focus elsewhere (the top bar, the menu) stays.
 */
export function focusAfterStart(isEmpty: boolean, isFocusLost: boolean): StartFocus | null {
  if (isEmpty) return "add-track";
  return isFocusLost ? "play" : null;
}
