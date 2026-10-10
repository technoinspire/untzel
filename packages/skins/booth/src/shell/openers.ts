// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Layer, UiState } from "./navigation";

/** The control that opened each layer, focused again when the layer closes. */
export type Openers<Control> = Readonly<Record<Layer, Control | null>>;

/**
 * Who gets focus back when each layer closes, after a navigation from `previous` to
 * `next`. `control` is what had focus; `isInPanel` says it lives in the panel.
 *
 * A control inside the panel (a library chip opening the detail) is not an opener, nor
 * is the body (the caller passes null): the new layer hands focus back to whatever opened
 * the layer before it. The length picker is the exception: the Pattern and part chips
 * live in the panel, and focus goes back to the chip that opened it.
 */
export function nextOpeners<Control>(
  openers: Openers<Control>,
  previous: UiState,
  next: UiState,
  control: Control | null,
  isInPanel: boolean,
): Openers<Control> {
  const outside = control !== null && !isInPanel ? control : null;
  let { overlay, code, panel } = openers;
  if (next.overlay !== null && previous.overlay === null) overlay = next.overlay === "length" ? control : outside;
  // Code next to Drop is the code's only door: focus goes back to it.
  if (next.isCodeShown && !previous.isCodeShown) code = outside ?? overlay;
  if (next.panel !== null && previous.panel === null) panel = outside ?? overlay;
  if (next.overlay === null) overlay = null;
  if (!next.isCodeShown) code = null;
  if (next.panel === null) panel = null;
  return { overlay, code, panel };
}
