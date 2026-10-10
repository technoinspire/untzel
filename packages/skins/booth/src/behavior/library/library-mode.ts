// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { canPlay } from "@untzel/session/rules";
import type { InstrumentGroup } from "@untzel/core";
import { inSongLabel } from "../text/format";
import type { LibraryEntryView, PatternContentView, TrackView } from "@untzel/presentation/view-model";
import { searchLabel } from "./library-labels";
import { strings } from "../../copy/copy";

// The library sheet opens to add a track or to change a track's sound.
// In replace mode it lists only the instruments that play every
// content of the track's pattern, by the language's own rule (canPlay), so the list and
// the write never disagree. Pure, tested without the DOM.

export type LibraryMode = { readonly kind: "add" } | { readonly kind: "replace"; readonly track: TrackView };

export const ADD_MODE: LibraryMode = { kind: "add" };

export interface LibraryTexts {
  readonly title: string;
  readonly hint: string;
  readonly searchLabel: string;
}

/** What a row's action does: add a track, use this sound for the track, or nothing (it is the sound now). */
export type RowRole = "add" | "use" | "current";

function contentWords(content: readonly PatternContentView[]): string {
  if (content.includes("chords")) return strings.chords;
  return content.includes("hits") ? strings.hits : strings.notes;
}

export function libraryTexts(mode: LibraryMode): LibraryTexts {
  if (mode.kind === "add") return { title: strings.addTrack, hint: strings.addTrackHint, searchLabel: searchLabel() };
  const { name, content } = mode.track;
  if (content.length === 0) return { title: strings.changeSound, hint: strings.noPatternYet(name), searchLabel: searchLabel() };
  const words = contentWords(content);
  return { title: strings.changeSound, hint: strings.keepsItsPattern(name, words), searchLabel: strings.searchSoundsThatPlay(words) };
}

/** The instruments the sheet lists: all of them to add, the compatible ones to change a sound. */
export function libraryEntries(mode: LibraryMode, entries: readonly LibraryEntryView[]): readonly LibraryEntryView[] {
  if (mode.kind === "add") return entries;
  return entries.filter((entry) => canPlay(entry.kind, mode.track.content));
}

/** The category chips with at least one instrument listed (Drums and FX leave for a bass). */
export function libraryCategoriesOf(entries: readonly LibraryEntryView[]): ReadonlySet<InstrumentGroup> {
  return new Set(entries.map((entry) => entry.group));
}

export function rowRole(mode: LibraryMode, entry: LibraryEntryView): RowRole {
  if (mode.kind === "add") return "add";
  return entry.instrument === mode.track.instrument ? "current" : "use";
}

/** The accessible name of the row's action cell. */
export function rowActionLabel(mode: LibraryMode, entry: LibraryEntryView): string {
  if (mode.kind === "add") return strings.addInstrument(entry.instrument);
  if (entry.instrument === mode.track.instrument) return strings.soundNow(entry.instrument);
  return strings.useFor(entry.instrument, mode.track.name);
}

/** "3 in song", or for the track's own instrument "current · rolling". */
export function rowUsage(mode: LibraryMode, entry: LibraryEntryView): string {
  if (mode.kind === "replace" && entry.instrument === mode.track.instrument) return strings.currentSound(mode.track.preset);
  return inSongLabel(entry.inSong);
}
