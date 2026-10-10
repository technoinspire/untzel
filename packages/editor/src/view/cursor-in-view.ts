// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

// From 768 px a line longer than the panel scrolls sideways.
// When the panel's width changes (the desktop divider), the place being
// edited stays in view instead of sliding out past the edge.

export function cursorStaysInView(): Extension {
  return ViewPlugin.define((view) => {
    let width = view.scrollDOM.clientWidth;
    let frame = 0;
    return {
      update(update: ViewUpdate) {
        if (!update.geometryChanged) return;
        const next = update.view.scrollDOM.clientWidth;
        if (next === width) return;
        width = next;
        // No dispatch inside an update: the next frame scrolls.
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const head = view.state.selection.main.head;
          view.dispatch({ effects: EditorView.scrollIntoView(head, { x: "nearest", y: "nearest" }) });
        });
      },
      destroy: () => cancelAnimationFrame(frame),
    };
  });
}
