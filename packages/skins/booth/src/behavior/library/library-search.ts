// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// What the library sheet shows for a search and a category:
// plain substring matching, never an expression. Pure, tested in Node.

import { INSTRUMENT_GROUPS, MAX_SUGGESTION_DISTANCE, editDistance, type InstrumentGroup } from "@untzel/core";
import type { LibraryEntryView } from "@untzel/presentation/view-model";
import { groupLabels } from "../../copy/copy";

export const MAX_QUERY_LENGTH = 64;
/** A group shows this many instruments until "Show all". */
export const GROUP_PREVIEW_COUNT = 3;
export const MAX_SUGGESTIONS = 3;

export type LibraryCategory = InstrumentGroup | "all";
/** The category chips in order: All, then every instrument group. */
export const LIBRARY_CATEGORIES: readonly LibraryCategory[] = ["all", ...INSTRUMENT_GROUPS];

export interface LibraryGroup {
  readonly group: InstrumentGroup;
  readonly entries: readonly LibraryEntryView[];
  /** Entries hidden until "Show all <n> <group>". */
  readonly hidden: number;
}

/** Trimmed, lower case, at most 64 characters. */
export function normalizeQuery(text: string): string {
  return text.trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);
}

/** The words a search looks into: name, model, sounds, description, category and tags. */
function searchable(entry: LibraryEntryView): readonly string[] {
  return [entry.instrument, ...(entry.model === null ? [] : entry.model.split(" ")), ...entry.sounds.map((sound) => sound.name), entry.description, groupLabels[entry.group], ...entry.tags].map((word) => word.toLowerCase());
}

export function matches(entry: LibraryEntryView, query: string): boolean {
  return query === "" || searchable(entry).some((word) => word.includes(query));
}

/**
 * The groups to show, in category order. A search or a single category shows every
 * match; "All" without a search shows three per group and the rest behind "Show all",
 * unless the group is `expanded`.
 */
export function libraryGroups(entries: readonly LibraryEntryView[], query: string, category: LibraryCategory, expanded: ReadonlySet<InstrumentGroup>): readonly LibraryGroup[] {
  const normalized = normalizeQuery(query);
  const browsing = normalized === "" && category === "all";
  return INSTRUMENT_GROUPS.flatMap((group) => {
    if (category !== "all" && category !== group) return [];
    const found = entries.filter((entry) => entry.group === group && matches(entry, normalized));
    if (found.length === 0) return [];
    const shown = browsing && !expanded.has(group) ? found.slice(0, GROUP_PREVIEW_COUNT) : found;
    return [{ group, entries: shown, hidden: found.length - shown.length }];
  });
}

/**
 * Up to three words to try when nothing matches: instrument and sound names at an edit
 * distance of 2 or less, closest first, then instruments whose tags contain a word of
 * the query.
 */
export function librarySuggestions(entries: readonly LibraryEntryView[], query: string): readonly string[] {
  const normalized = normalizeQuery(query);
  if (normalized === "") return [];
  const names = [...new Set(entries.flatMap((entry) => [entry.instrument, ...entry.sounds.map((sound) => sound.name)]))];
  const close = names
    .map((name) => ({ name, distance: editDistance(normalized, name) }))
    .filter(({ distance }) => distance > 0 && distance <= MAX_SUGGESTION_DISTANCE)
    .sort((a, b) => a.distance - b.distance || (a.name < b.name ? -1 : 1))
    .map(({ name }) => name);
  const tagged = entries.filter((entry) => entry.tags.some((tag) => normalized.includes(tag) || tag.includes(normalized))).map((entry) => entry.instrument);
  return [...new Set([...close, ...tagged])].slice(0, MAX_SUGGESTIONS);
}
