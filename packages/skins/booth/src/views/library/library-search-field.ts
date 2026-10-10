// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element } from "../dom";
import { icon } from "../icons";
import { comboboxAttributes } from "../../behavior/library/library-grid";
import { MAX_QUERY_LENGTH } from "../../behavior/library/library-search";

export interface LibrarySearchField {
  readonly root: HTMLElement;
  /** Writes a word into the search, as a suggestion of the empty result does. */
  setQuery(query: string): void;
  /** Points aria-activedescendant at the active row's name cell; null clears it. */
  setActiveDescendant(id: string | null): void;
  /** The field's name and placeholder: "Search sounds that play notes" in Change sound. */
  setLabel(label: string): void;
}

export interface LibrarySearchCallbacks {
  readonly onQuery: (query: string) => void;
  /** A key pressed in the search; returns true when the sheet acted on it. */
  readonly onKey: (event: KeyboardEvent) => boolean;
}

/** The search of the library: a magnifier and a combobox over the grid of instruments. */
export function createLibrarySearchField(callbacks: LibrarySearchCallbacks): LibrarySearchField {
  const input = element("input", { className: "ui-library__search", attributes: comboboxAttributes(MAX_QUERY_LENGTH) });
  input.addEventListener("input", () => callbacks.onQuery(input.value));
  input.addEventListener("keydown", (event) => {
    if (callbacks.onKey(event)) event.preventDefault();
  });
  return {
    root: element("div", { className: "ui-library__field" }, [icon("search"), input]),
    setQuery(query) {
      input.value = query;
    },
    setLabel(label) {
      input.setAttribute("aria-label", label);
      input.setAttribute("placeholder", label);
    },
    setActiveDescendant(id) {
      if (id === null) input.removeAttribute("aria-activedescendant");
      else input.setAttribute("aria-activedescendant", id);
    },
  };
}
