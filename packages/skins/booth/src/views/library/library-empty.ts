// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element } from "../dom";
import { nothingFoundHint, nothingFoundLabel, suggestionsLead } from "../../behavior/library/library-labels";

export interface LibraryEmpty {
  readonly root: HTMLElement;
  /** Shown with the query and its suggestions; hidden for null. */
  update(query: string | null, suggestions: readonly string[]): void;
}

/** Nothing matched; up to three close words to try. */
export function createLibraryEmpty(pick: (word: string) => void): LibraryEmpty {
  const root = element("div", { className: "ui-library__empty", attributes: { hidden: true } });
  return {
    root,
    update(query, suggestions) {
      root.hidden = query === null;
      if (query === null) return;
      root.replaceChildren(
        element("p", { className: "ui-library__nothing", text: nothingFoundLabel(query.trim()) }),
        ...(suggestions.length === 0 ? [] : [element("p", { className: "ui-library__lead", text: suggestionsLead() })]),
        element("div", { className: "ui-library__suggestions" }, suggestions.map((word) => button("ui-pill ui-pill--chip", word, () => pick(word)))),
        element("p", { className: "ui-library__hint", text: nothingFoundHint() }),
      );
    },
  };
}
