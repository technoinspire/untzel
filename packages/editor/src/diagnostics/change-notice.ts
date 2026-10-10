// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { EditorView } from "@codemirror/view";
import { flashLine } from "../highlight/decorations";
import type { CodeState } from "../ports";

/** "Line 11 changed by the acid track": the notice under the code and the line's flash. */
export class ChangeNotice {
  readonly element = document.createElement("p");
  #lastId: number | null = null;
  #timer: number | undefined;

  constructor() {
    this.element.className = "untzel-editor__notice";
    this.element.setAttribute("role", "status");
    this.element.hidden = true;
  }

  show(view: EditorView, state: CodeState, lingerMs: number): void {
    const change = state.lastChange;
    if (change === null || change.id === this.#lastId) return;
    this.#lastId = change.id;
    this.element.textContent = change.message;
    this.element.hidden = change.message === "";
    view.dispatch({ effects: flashLine.of(change.line) });
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => view.dispatch({ effects: flashLine.of(null) }), lingerMs);
  }

  destroy(): void {
    window.clearTimeout(this.#timer);
    this.element.remove();
  }
}
