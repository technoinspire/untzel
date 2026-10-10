// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentGroup } from "@untzel/core";
import type { ComboboxAction } from "../../behavior/library/library-combobox";
import type { LibraryCategory } from "../../behavior/library/library-search";
import type { AuditionView, LibraryEntryView } from "@untzel/presentation/view-model";
import type { LibraryRowActions } from "./library-row";

/** What the sheet shows besides the view: the search, the category and the open groups. */
export interface Browse {
  query: string;
  category: LibraryCategory;
  readonly expanded: Set<InstrumentGroup>;
  /** Index of the active row among the instruments shown (the combobox). */
  active: number;
}

/** Enter on the active row adds it with what it plays; Space plays it, or stops it while it plays. */
export function entryAction(kind: "add" | "toggle-preview", entry: LibraryEntryView, audition: AuditionView | null): "choose" | "preview" | "stop" {
  if (kind === "add") return "choose";
  return audition?.instrument === entry.instrument ? "stop" : "preview";
}

/**
 * The search's keys, as a combobox over the rows: the arrows move the active row, Enter
 * and Space act on it. Returns a handler that says false when the key only types.
 */
export function createLibraryKeys(
  browse: Browse,
  entries: () => readonly LibraryEntryView[],
  audition: () => AuditionView | null | undefined,
  actions: LibraryRowActions,
  markActive: () => void,
  scrollToActive: (active: number) => void,
): (action: ComboboxAction | null) => boolean {
  return (action) => {
    if (action === null) return false;
    if (action.kind === "move") {
      browse.active = action.active;
      markActive();
      scrollToActive(browse.active);
      return true;
    }
    const entry = entries()[browse.active];
    const shown = entry === undefined ? undefined : audition();
    if (entry === undefined || shown === undefined) return true;
    const playing = shown?.instrument === entry.instrument ? shown : null;
    const next = entryAction(action.kind, entry, shown);
    if (next === "choose") actions.choose(entry.instrument, playing?.sound ?? null, playing?.pattern ?? null);
    else if (next === "preview") actions.preview(entry.instrument, null, null);
    else actions.stop();
    return true;
  };
}
