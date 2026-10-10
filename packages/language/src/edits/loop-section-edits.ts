// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { SectionSyntax } from "../highlight/outline";
import { EditableSource, type NamedTrack } from "./document";
import { applyChanges, failure, type EditResult, type TextChange } from "./text-changes";

// The loop section: `section … | loop` is what
// the loop mode plays, so the edits that make a track heard in loop mode also touch it.

const isLoopModifier = (modifier: { readonly name: { readonly text: string } }): boolean => modifier.name.text === "loop";

/** The section written with "| loop", or null. */
export function loopSection(document: EditableSource): SectionSyntax | null {
  return document.sections().find((section) => section.modifiers.some(isLoopModifier)) ?? null;
}

/** Appends `track` to the loop section, when the text has one and it lacks the name. */
export function joinLoopSection(document: EditableSource, track: string): TextChange[] {
  const section = loopSection(document);
  if (section === null || section.tracks.some((token) => token.text === track)) return [];
  const at = section.tracks.at(-1)?.to ?? section.name.to;
  return [{ from: at, to: at, insert: ` ${track}` }];
}

function muteModifiers(track: NamedTrack) {
  return track.syntax.modifiers.filter((modifier) => modifier.name.text === "mute");
}

/**
 * A tap on a track block in loop mode with a loop section, in one edit: outside the
 * section it joins it (and loses "mute"); inside with "mute" it loses the mute; inside
 * without "mute" it leaves the section.
 */
export function toggleLoopMember(source: string, track: string): EditResult {
  const document = new EditableSource(source);
  const found = document.track(track);
  if (found === null) return failure("UNKNOWN_TRACK");
  const section = loopSection(document);
  if (section === null) return failure("NO_LOOP_SECTION");
  const mutes = muteModifiers(found).map((modifier) => document.removeModifier(modifier));
  const isMember = section.tracks.some((token) => token.text === track);
  if (!isMember) return applyChanges(source, [...joinLoopSection(document, track), ...mutes]);
  if (mutes.length > 0) return applyChanges(source, mutes);
  if (section.tracks.every((token) => token.text === track)) return failure("SECTION_WOULD_BE_EMPTY");
  return applyChanges(source, [document.rewriteSectionTracks(section, (token) => token.text !== track)]);
}

function loopRemovals(document: EditableSource, section: SectionSyntax): TextChange[] {
  return section.modifiers.filter(isLoopModifier).map((modifier) => document.removeModifier(modifier));
}

/** Moves "| loop" to `target` in one edit; no change when it is already there. */
export function moveLoop(source: string, target: string): EditResult {
  const document = new EditableSource(source);
  const destination = document.sections().find((section) => section.name.text === target);
  if (destination === undefined) return failure("UNKNOWN_SECTION");
  const current = loopSection(document);
  if (current === destination) return applyChanges(source, []);
  return applyChanges(source, [...(current === null ? [] : loopRemovals(document, current)), ...loopChange(destination)]);
}

function loopChange(section: SectionSyntax): TextChange[] {
  const at = section.modifiers.at(-1)?.to ?? section.tracks.at(-1)?.to ?? section.name.to;
  return [{ from: at, to: at, insert: " | loop" }];
}

/** The section with the most tracks; a tie goes to the first declared. */
export function fullestSection(document: EditableSource): SectionSyntax | null {
  return document.sections().reduce<SectionSyntax | null>((best, section) => (best === null || section.tracks.length > best.tracks.length ? section : best), null);
}

/**
 * The Drop of loop mode: every "mute" goes and, with a loop section, "| loop" moves to
 * the fullest section, all in one edit.
 */
export function dropEdit(source: string): EditResult {
  const document = new EditableSource(source);
  const unmutes = document.tracks.flatMap((track) => muteModifiers(track).map((modifier) => document.removeModifier(modifier)));
  const current = loopSection(document);
  const fullest = fullestSection(document);
  if (current === null || fullest === null || fullest === current) return applyChanges(source, unmutes);
  return applyChanges(source, [...unmutes, ...loopRemovals(document, current), ...loopChange(fullest)]);
}
