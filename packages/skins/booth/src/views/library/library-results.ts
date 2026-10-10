// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentGroup } from "@untzel/core";
import { element, setText } from "../dom";
import { GRID_ATTRIBUTES, activeDescendant } from "../../behavior/library/library-grid";
import { resultsLabel } from "../../behavior/library/library-labels";
import type { LibraryGroup } from "../../behavior/library/library-search";
import type { AuditionView } from "@untzel/presentation/view-model";
import { libraryGroupRows } from "./library-group";
import type { LibraryRowActions } from "./library-row";

export interface LibraryResults {
  /** The "<n> results" line and the grid, in that order. */
  readonly nodes: readonly HTMLElement[];
  /** Redraws the rows; the results line shows only while a search is written. */
  update(groups: readonly LibraryGroup[], audition: AuditionView | null, isSearching: boolean): void;
  /** Marks the active row and returns the id for the search's aria-activedescendant. */
  markActive(active: number): string | null;
  scrollToActive(active: number): void;
}

/** The grid of instruments of the library, grouped, with the results line over it. */
export function createLibraryResults(actions: LibraryRowActions, showAll: (group: InstrumentGroup) => void): LibraryResults {
  const results = element("p", { className: "ui-library__results", attributes: { hidden: true } });
  const list = element("ul", { className: "ui-library__list", attributes: GRID_ATTRIBUTES });
  let instruments: readonly string[] = [];
  const rows = (): HTMLElement[] => Array.from(list.querySelectorAll<HTMLElement>(".ui-library__row"));
  return {
    nodes: [results, list],
    update(groups, audition, isSearching) {
      instruments = groups.flatMap((group) => group.entries.map((entry) => entry.instrument));
      results.hidden = !isSearching || instruments.length === 0;
      setText(results, resultsLabel(instruments.length));
      list.replaceChildren(...groups.flatMap((group) => libraryGroupRows(group, audition, actions, !isSearching, () => showAll(group.group))));
    },
    markActive(active) {
      rows().forEach((row, index) => row.setAttribute("aria-selected", String(index === active)));
      return activeDescendant(instruments, active);
    },
    scrollToActive(active) {
      rows()[active]?.scrollIntoView({ block: "nearest" });
    },
  };
}
