// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Words of the library sheet, as plain functions tested without the DOM. They
// read the live catalogs of copy.ts, so each call speaks the current language.

import type { InstrumentGroup } from "@untzel/core";
import type { AuditionView, LibraryEntryView } from "@untzel/presentation/view-model";
import { groupLabels, strings } from "../../copy/copy";

export function soundsLabel(count: number): string {
  return strings.soundCount(count);
}

/** The search's name and placeholder, read on every language change. */
export function searchLabel(): string {
  return strings.searchInstruments;
}

/** "2 results": the line over the rows while a search is written. */
export function resultsLabel(count: number): string {
  return strings.resultCount(count);
}

/**
 * What the sheet's status region says when the audition changes: "Playing piano, grand"
 * when it starts or switches sound, "Preview stopped" when it ends, null otherwise.
 */
export function auditionAnnouncement(previous: AuditionView | null, current: AuditionView | null): string | null {
  if (current === null) return previous === null ? null : strings.previewStopped;
  if (previous !== null && previous.instrument === current.instrument && previous.sound === current.sound) return null;
  return strings.playingSound(current.instrument, current.sound);
}

/** "Playing boom in c minor"; a pattern that is not the first is named: "Playing boom · Broken in c minor". */
export function playingLabel(sound: string, key: string, pattern: string | null = null): string {
  return pattern === null ? strings.playingIn(sound, key) : strings.playingIn(`${sound} · ${pattern}`, key);
}

/** Change sound while it previews: "bass plays acid · squelch in the music". */
export function trackPlaysLabel(track: string, instrument: string, sound: string): string {
  return strings.trackPlaysInMusic(track, `${instrument} · ${sound}`);
}
/** What is not the default, after the instrument: "kick · boom · Broken". */
function chosen(entry: LibraryEntryView, sound: string | null, pattern: string | null): string {
  const words = [entry.instrument];
  if (sound !== null && sound !== entry.sounds[0]?.name) words.push(sound);
  if (pattern !== null && pattern !== entry.patterns[0]) words.push(pattern);
  return words.join(" · ");
}

/** The add button while auditioning: the sound and the pattern are named only when they are not the default. */
export function addLabel(entry: LibraryEntryView, sound: string | null, pattern: string | null = null): string {
  return strings.addInstrument(chosen(entry, sound, pattern));
}

/** Change sound's button: "Use acid · squelch", or "Use acid" with its default sound. */
export function useLabel(entry: LibraryEntryView, sound: string | null): string {
  return strings.useChoice(chosen(entry, sound, null));
}

/** The pattern a row's audition names: null when it is the first (the default) or none. */
export function namedPattern(entry: LibraryEntryView, pattern: string | null): string | null {
  return pattern === null || pattern === entry.patterns[0] ? null : pattern;
}

export function previewLabel(instrument: string, isPlaying: boolean): string {
  return isPlaying ? strings.stopPreview : strings.previewInstrument(instrument);
}

export function showAllLabel(count: number, group: InstrumentGroup): string {
  return strings.showAllOf(count, groupLabels[group]);
}

export function nothingFoundLabel(query: string): string {
  return strings.nothingCalled(query);
}

export function suggestionsLead(): string {
  return strings.suggestionsLead;
}

export function nothingFoundHint(): string {
  return strings.nothingFoundHint;
}
