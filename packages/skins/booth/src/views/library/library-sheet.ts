// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element, setText } from "../dom";
import type { LibraryIntents, PatternIntents, SoundIntents } from "@untzel/skin-contract";
import { comboboxAction } from "../../behavior/library/library-combobox";
import { ADD_MODE, libraryCategoriesOf, libraryEntries, libraryTexts, type LibraryMode } from "../../behavior/library/library-mode";
import { libraryGroups, librarySuggestions, normalizeQuery, type LibraryGroup } from "../../behavior/library/library-search";
import type { LibraryEntryView, TrackView, UntzelView } from "@untzel/presentation/view-model";
import { translator } from "../../copy/copy";
import { createLibraryCategories } from "./library-categories";
import { createLibraryEmpty } from "./library-empty";
import { createLibraryFooter } from "./library-footer";
import { createLibraryResults } from "./library-results";
import type { LibraryRowActions } from "./library-row";
import { auditionOf, rowActions, type LibrarySheetCallbacks } from "./library-sheet-actions";
import { createLibraryKeys, type Browse } from "./library-sheet-keys";
import { createLibrarySearchField } from "./library-search-field";
import { createLibraryStatus } from "./library-status";
import { createSheet, type Sheet } from "../sheets/sheet";

export interface LibrarySheet extends Sheet {
  /** `track` null adds a track; a track opens Change sound for it. */
  update(view: UntzelView, track: TrackView | null): void;
}

export type { LibrarySheetCallbacks };

/** The key of what the grid shows, language included; the grid is redrawn only when it changes. */
function shownKey(view: UntzelView, mode: LibraryMode, browse: Browse): string {
  const library = view.library.map((entry) => `${entry.instrument}:${entry.inSong}`);
  const target = mode.kind === "add" ? null : [mode.track.name, mode.track.instrument, mode.track.preset, mode.track.content];
  return JSON.stringify([translator.locale(), library, auditionOf(view, mode), target, browse.query, browse.category, [...browse.expanded]]);
}

/**
 * The library: search, nine categories, grouped instruments with a preview before adding;
 * and the same sheet in replace mode for Change sound. The search
 * is a combobox over a grid (library-grid.ts, library-combobox.ts); a status region says
 * when an audition starts and ends. This function only wires the parts.
 */
// Over 40 lines: one sheet built and drawn; its row actions and keys are their own modules.
export function createLibrarySheet(intents: LibraryIntents & SoundIntents & PatternIntents, callbacks: LibrarySheetCallbacks): LibrarySheet {
  let mode: LibraryMode = ADD_MODE;
  const sheet = createSheet({ id: "ui-library", title: libraryTexts(ADD_MODE).title, className: "ui-sheet--library", onClose: () => {
    rowActions(mode, intents, callbacks).stop();
    callbacks.onClose();
  } });
  const browse: Browse = { query: "", category: "all", expanded: new Set(), active: 0 };
  let last: UntzelView | null = null;
  let key = "";
  let shown: readonly LibraryGroup[] = [];
  const entries = (): readonly LibraryEntryView[] => shown.flatMap((group) => group.entries);
  const browseTo = (change: Partial<Browse>): void => {
    Object.assign(browse, change);
    render();
  };
  const search = createLibrarySearchField({
    onQuery: (query) => browseTo({ query, active: 0 }),
    onKey: (event) => act(comboboxAction(event, { count: entries().length, active: browse.active })),
  });
  const categories = createLibraryCategories((category) => browseTo({ category, active: 0 }));
  // The rows read the actions of the mode shown now, so one grid serves both modes.
  const actions: LibraryRowActions = {
    get mode() {
      return mode;
    },
    preview: (instrument, sound, pattern) => rowActions(mode, intents, callbacks).preview(instrument, sound, pattern),
    stop: () => rowActions(mode, intents, callbacks).stop(),
    choose: (instrument, sound, pattern) => rowActions(mode, intents, callbacks).choose(instrument, sound, pattern),
  };
  const results = createLibraryResults(actions, (group) => {
    browse.expanded.add(group);
    render();
  });
  const empty = createLibraryEmpty((word) => {
    search.setQuery(word);
    browseTo({ query: word });
  });
  const status = createLibraryStatus();
  const footer = createLibraryFooter();
  const hint = element("p", { className: "ui-sheet__hint" });
  sheet.body.append(hint, search.root, categories.root, ...results.nodes, empty.root, status.root, footer.root);
  const markActive = (): void => search.setActiveDescendant(results.markActive(browse.active));
  const render = (): void => {
    if (last === null) return;
    const view = last;
    const nextKey = shownKey(view, mode, browse);
    if (nextKey === key) return;
    key = nextKey;
    const listed = libraryEntries(mode, view.library);
    shown = libraryGroups(listed, browse.query, browse.category, browse.expanded);
    categories.update(browse.category, libraryCategoriesOf(listed));
    results.update(shown, auditionOf(view, mode), normalizeQuery(browse.query) !== "");
    empty.update(shown.length === 0 ? browse.query : null, librarySuggestions(listed, browse.query));
    browse.active = Math.min(browse.active, Math.max(0, entries().length - 1));
    markActive();
  };
  /** Carries out a key of the search; false when the key only types. */
  const act = createLibraryKeys(browse, entries, () => (last === null ? undefined : auditionOf(last, mode)), actions, markActive, (active) => results.scrollToActive(active));
  return {
    ...sheet,
    update(view, track) {
      const next: LibraryMode = track === null ? ADD_MODE : { kind: "replace", track };
      if (next.kind !== mode.kind || (next.kind === "replace" && mode.kind === "replace" && next.track.name !== mode.track.name)) {
        Object.assign(browse, { query: "", category: "all", active: 0 });
        browse.expanded.clear();
        search.setQuery("");
      }
      mode = next;
      last = view;
      const texts = libraryTexts(mode);
      setText(sheet.heading, texts.title);
      setText(hint, texts.hint);
      search.setLabel(texts.searchLabel);
      render();
      status.update(auditionOf(view, mode));
      footer.update(view.transport.cpu);
    },
  };
}
