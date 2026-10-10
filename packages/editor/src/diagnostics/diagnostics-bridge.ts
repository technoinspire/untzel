// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { setDiagnostics } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Diagnostic, DiagnosticFix } from "@untzel/language";
import { firstFix, toLintDiagnostics } from "./lint-diagnostics";
import type { CodeState } from "../ports";
import { heardKey, nextAnnouncement } from "./problem-announcement";
import { problemKey, renderProblems, shownProblems } from "./quick-fixes";

// The session's diagnostics in the editor: the lint marks and
// actions, the error block with its fix and Ignore buttons, and Mod+. for the first fix.
// A fix is the minimal text edit the analysis attached; it applies only to the text it
// was made for, and then goes to the session at once.

export class DiagnosticsBridge {
  readonly panel = document.createElement("div");
  view: EditorView | null = null;
  readonly #applyNow: () => void;
  readonly #announce: (message: string) => void;
  #analyzed: { source: string; diagnostics: readonly Diagnostic[] } = { source: "", diagnostics: [] };
  readonly #ignored = new Set<string>();
  /** The errors of the last analysis, so only a new one is announced. */
  #heard: ReadonlySet<string> = new Set();

  constructor(applyNow: () => void, announce: (message: string) => void) {
    this.#applyNow = applyNow;
    this.#announce = announce;
    this.panel.className = "untzel-editor__problems";
    this.panel.hidden = true;
  }

  /** The lint state is added by setDiagnostics itself; nothing to configure up front. */
  extension(): Extension {
    return [];
  }

  show(state: CodeState): void {
    const view = this.view;
    if (view === null) return;
    if (state.source !== this.#analyzed.source) this.#ignored.clear();
    this.#analyzed = { source: state.source, diagnostics: state.diagnostics };
    this.refresh();
    this.#announceNew(view, state.diagnostics);
  }

  apply(fix: DiagnosticFix): boolean {
    const view = this.view;
    if (view === null || view.state.doc.toString() !== this.#analyzed.source) return false;
    // A fix chosen in the error block removes its own button: the focus goes back to
    // the editor, after the corrected text, instead of falling to the page. Not on a
    // touch screen, where focusing the editor would open the system keyboard.
    const fromBlock = this.panel.contains(document.activeElement) && !matchMedia("(pointer: coarse)").matches;
    const changes = view.state.changes(fix.changes.map((change) => ({ ...change })));
    const last = fix.changes.at(-1);
    const after = last === undefined ? view.state.selection.main.head : changes.mapPos(last.to, 1);
    view.dispatch({ changes, selection: { anchor: after }, userEvent: "input.fix" });
    if (fromBlock) view.focus();
    this.#applyNow();
    return true;
  }

  #announceNew(view: EditorView, diagnostics: readonly Diagnostic[]): void {
    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    const doc = view.state.doc;
    const message = nextAnnouncement(this.#heard, errors, (offset) => doc.lineAt(Math.min(offset, doc.length)).number);
    this.#heard = new Set(errors.map(heardKey));
    if (message !== null) this.#announce(message);
  }

  /** Redraws the marks and the error block in the current language. */
  refresh(): void {
    const view = this.view;
    if (view === null) return;
    const lint = toLintDiagnostics(this.#analyzed.diagnostics, view.state.doc.length, (fix) => void this.apply(fix));
    view.dispatch(setDiagnostics(view.state, lint));
    this.#render();
  }

  fixFirst(): boolean {
    const view = this.view;
    const fix = view === null ? null : firstFix(this.#analyzed.diagnostics, view.state.selection.main.head);
    return fix === null ? false : this.apply(fix);
  }

  #render(): void {
    renderProblems(this.panel, shownProblems(this.#analyzed.diagnostics, this.#ignored), {
      fix: (fix) => void this.apply(fix),
      ignore: (diagnostic) => {
        this.#ignored.add(problemKey(diagnostic));
        this.#render();
      },
    });
  }
}
