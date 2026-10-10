// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { Compartment, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

// Never strand a "|". From 768 px: no wrapping,
// one line per track, the content scrolls sideways. On a phone: wrapping on, and the
// "u-mod" groups (white-space: nowrap) leave a break only before a "|".

export const WIDE_QUERY = "(min-width: 768px)";

/** Wrapping for a layout: on below 768 px, off from there. */
export function wrapsAt(wide: boolean): boolean {
  return !wide;
}

const wrapping = new Compartment();

function wrapFor(wide: boolean): Extension {
  return wrapsAt(wide) ? EditorView.lineWrapping : [];
}

export function responsiveWrapping(): Extension {
  const wide = typeof matchMedia === "function" ? matchMedia(WIDE_QUERY) : null;
  return [
    wrapping.of(wrapFor(wide?.matches ?? false)),
    ViewPlugin.define((view) => {
      const change = (event: MediaQueryListEvent): void => view.dispatch({ effects: wrapping.reconfigure(wrapFor(event.matches)) });
      wide?.addEventListener("change", change);
      return { destroy: () => wide?.removeEventListener("change", change) };
    }),
  ];
}
