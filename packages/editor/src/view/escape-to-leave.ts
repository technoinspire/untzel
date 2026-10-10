// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { completionStatus } from "@codemirror/autocomplete";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

// A way out of the editor by keyboard: the first Esc stays in the editor
// and lets the next Tab leave it instead of indenting; a second Esc in a row goes on to
// the page, which closes Code. An open completion list takes its own Esc first.

/** How long Tab leaves after the first Esc, as CodeMirror's own Esc then Tab. */
export const TAB_LEAVES_MS = 2000;

export function escapeToLeave(onArmed: () => void): Extension {
  let armed = false;
  return [
    Prec.high(
      keymap.of([
        {
          key: "Escape",
          run: (view) => {
            if (completionStatus(view.state) !== null) return false;
            if (armed) {
              armed = false;
              return false;
            }
            armed = true;
            view.setTabFocusMode(TAB_LEAVES_MS);
            onArmed();
            return true;
          },
          stopPropagation: true,
        },
      ]),
    ),
    EditorView.domEventHandlers({
      keydown: (event) => {
        if (event.key !== "Escape") armed = false;
        return false;
      },
      blur: () => {
        armed = false;
        return false;
      },
    }),
  ];
}
