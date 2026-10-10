// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { Prec, StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap, showTooltip, type Tooltip } from "@codemirror/view";
import type { HoverHelp } from "@untzel/commands";
import { completionKeys, HELP_KEY } from "./assist-keys";
import type { CodeHelp } from "../ports";

// The editor helps: completion from the
// registry and the grammar, and help under the cursor, by mouse (hover) or keyboard
// (Alt+I, Esc closes). The words come from @untzel/commands; this file only shows them.

/** Letters, digits and the characters of notes, hits, divisions and signals. */
const VALID_FOR = /^[A-Za-z0-9_#.()/~-]*$/;

function source(help: CodeHelp) {
  return (context: CompletionContext): CompletionResult | null => {
    const found = help.completeCode(context.state.doc.toString(), context.pos);
    if (found === null) return null;
    const typed = context.pos - found.from;
    // While typing, open only once a word is started, and never inside the steps.
    if (!context.explicit && (typed === 0 || found.explicitOnly)) return null;
    return {
      from: found.from,
      // "open" writes "open 0": the line stays valid while the person picks a value.
      options: found.options.map((option) => ({ label: option.label, detail: option.detail, ...(option.insert === undefined ? {} : { apply: option.insert }) })),
      validFor: VALID_FOR,
    };
  };
}

function tooltipDom(help: HoverHelp): HTMLElement {
  const box = document.createElement("div");
  box.className = "cm-untzel-help";
  help.lines.forEach((line, index) => {
    const row = document.createElement("p");
    row.className = index === 0 ? "cm-untzel-help__title" : "cm-untzel-help__line";
    row.textContent = line;
    box.append(row);
  });
  return box;
}

function tooltipOf(help: HoverHelp): Tooltip {
  return { pos: help.from, end: help.to, above: true, create: () => ({ dom: tooltipDom(help) }) };
}

const setKeyboardHelp = StateEffect.define<Tooltip | null>();

/** The help Alt+I opens at the cursor; closed by Esc, a selection move or an edit. */
const keyboardHelp = StateField.define<Tooltip | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(setKeyboardHelp)) return effect.value;
    return transaction.docChanged || transaction.selection !== undefined ? null : value;
  },
  provide: (field) => showTooltip.from(field),
});

export function codeAssist(help: CodeHelp): Extension {
  const openHelp = (view: EditorView): boolean => {
    const found = help.hover(view.state.doc.toString(), view.state.selection.main.head);
    view.dispatch({ effects: setKeyboardHelp.of(found === null ? null : tooltipOf(found)) });
    return true;
  };
  const closeHelp = (view: EditorView): boolean => {
    if (view.state.field(keyboardHelp) === null) return false;
    view.dispatch({ effects: setKeyboardHelp.of(null) });
    return true;
  };
  return [
    // Its own keymap: CodeMirror's would take Alt+I for the list (completionKeys).
    autocompletion({ override: [source(help)], icons: false, closeOnBlur: true, maxRenderedOptions: 40, defaultKeymap: false }),
    Prec.highest(keymap.of([...completionKeys()])),
    hoverTooltip((view, pos) => {
      const found = help.hover(view.state.doc.toString(), pos);
      return found === null ? null : tooltipOf(found);
    }),
    keyboardHelp,
    // Esc closes the list or the help first; only then does it reach the sheet.
    Prec.highest(keymap.of([{ key: "Escape", run: (view) => closeCompletion(view) || closeHelp(view), stopPropagation: true }])),
    Prec.high(keymap.of([
      { key: "Tab", run: acceptCompletion },
      { key: HELP_KEY, run: openHelp },
    ])),
  ];
}
