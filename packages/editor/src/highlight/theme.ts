// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

// The editor's frame: font, caret, gutters, selection, the changed-line flash and the
// popups. The language's colors, the track
// colors, the sounding pill and the error underline are in styles/language.css.

const STAGE = "#0B0B0C";
const SURFACE = "#161719";
const RAISED = "#26282D";
const TEXT = "#FFFFFF";
const MUTED = "#AAA5A1";
const FLARE = "#F65D00";

/** Continuation lines of a wrapped line start this far in; tracks hang under their pattern. */
const HANGING_INDENT = "7ch";
const MONO = "var(--font-mono, ui-monospace, Menlo, monospace)";
const SANS = "var(--font-sans, sans-serif)";

// Over 40 lines: one CodeMirror theme literal, a selector per entry.
export function untzelTheme(): Extension {
  return EditorView.theme(
    {
      "&": {
        color: TEXT,
        backgroundColor: "transparent",
        fontSize: "var(--untzel-code-size, 12.5px)",
        height: "100%",
      },
      // The editor with focus shows the page's ring: 17.94:1 on the surface.
      // Inset, so the panel's edges never clip it.
      "&.cm-focused": { outline: `2px solid ${TEXT}`, outlineOffset: "-2px" },
      ".cm-scroller": {
        fontFamily: MONO,
        lineHeight: "var(--untzel-code-line, 21px)",
        scrollbarWidth: "thin",
        scrollbarColor: `${RAISED} ${SURFACE}`,
      },
      ".cm-content": { caretColor: FLARE, padding: "0 0 24px" },
      ".cm-line": { paddingLeft: HANGING_INDENT, textIndent: `-${HANGING_INDENT}` },
      ".cm-cursor, .cm-dropCursor": { borderLeft: `2px solid ${FLARE}` },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "rgb(246 93 0 / 30%)",
      },
      ".cm-gutters": { backgroundColor: SURFACE, color: MUTED, border: "none" },
      ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 0", minWidth: "26px", textAlign: "left" },
      ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
      ".cm-untzel-changed": { backgroundColor: "rgb(246 93 0 / 10%)", borderRadius: "4px" },
      // Completion and help: the stage's black, a raised border and selected row.
      ".cm-tooltip": { backgroundColor: STAGE, color: TEXT, border: `1px solid ${RAISED}`, borderRadius: "10px" },
      ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: MONO, fontSize: "12.5px", maxHeight: "16em", padding: "4px" },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li": { padding: "6px 10px", borderRadius: "6px", lineHeight: "20px" },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: RAISED, color: TEXT },
      ".cm-completionLabel": { color: TEXT },
      ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "700" },
      ".cm-completionDetail": { color: MUTED, fontStyle: "normal", fontFamily: SANS, fontSize: "11.5px", marginLeft: "16px" },
      ".cm-untzel-help": { padding: "10px 14px", maxWidth: "320px", fontFamily: SANS },
      ".cm-untzel-help__title": { margin: "0", color: TEXT, fontFamily: MONO, fontSize: "13px", fontWeight: "600", lineHeight: "19px" },
      ".cm-untzel-help__line": { margin: "0", color: MUTED, fontSize: "12px", lineHeight: "17px" },
    },
    { dark: true },
  );
}
