// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { MAX_PART_BARS, MIN_PART_BARS } from "../limits";
import { checkName } from "../vocabulary/name-rules";
import { nextFreeName } from "../vocabulary/track-names";
import { EditableSource } from "./document";
import { applyChanges, failure, type EditResult, type NamedEditResult, type TextChange } from "./text-changes";

// Minimal edits for the arrangement gestures.

/** Adds the track name at the end of the section, or removes it. No change when already so. */
export function setSectionMembership(source: string, section: string, track: string, member: boolean): EditResult {
  const document = new EditableSource(source);
  const found = document.sections().find((candidate) => candidate.name.text === section);
  if (found === undefined) return failure("UNKNOWN_SECTION");
  if (!document.trackNames().has(track)) return failure("UNKNOWN_TRACK");
  const isMember = found.tracks.some((token) => token.text === track);
  if (member === isMember) return applyChanges(source, []);
  if (member) {
    const at = found.tracks.at(-1)?.to ?? found.name.to;
    return applyChanges(source, [{ from: at, to: at, insert: ` ${track}` }]);
  }
  if (found.tracks.every((token) => token.text === track)) return failure("SECTION_WOULD_BE_EMPTY");
  return applyChanges(source, [document.rewriteSectionTracks(found, (token) => token.text !== track)]);
}

/**
 * Renames a section and every use of it in the song, in one edit.
 * Section names are their own space: a part may share a track's name.
 */
export function renameSection(source: string, section: string, newName: string): EditResult {
  const document = new EditableSource(source);
  const found = document.sections().find((candidate) => candidate.name.text === section);
  if (found === undefined) return failure("UNKNOWN_SECTION");
  if (newName === section) return applyChanges(source, []);
  const problem = checkName(newName, new Set(document.sections().map((candidate) => candidate.name.text)));
  if (problem !== null) return failure(problem);
  const uses = (document.song()?.parts ?? []).filter((part) => part.section.text === section);
  return applyChanges(source, [found.name, ...uses.map((part) => part.section)].map((token) => ({ from: token.from, to: token.to, insert: newName })));
}

/** Replaces the bar count of one part of the song. */
export function setPartBars(source: string, partIndex: number, bars: number): EditResult {
  if (!Number.isInteger(bars) || bars < MIN_PART_BARS || bars > MAX_PART_BARS) return failure("INVALID_VALUE");
  const part = new EditableSource(source).song()?.parts[partIndex];
  if (part === undefined) return failure("UNKNOWN_PART");
  return applyChanges(source, [{ from: part.bars.from, to: part.bars.to, insert: String(bars) }]);
}

// Part order, copies and new parts (the Song view lists
// the parts in playing order). Only the song line and, for a new part, one section line
// change; the separators between parts stay as written.

const PART_SEPARATOR = ", ";
const NEW_SECTION_NAME = "part";

/** Move up (-1) or down (+1): the part swaps places with its neighbour, in one edit. */
export function movePart(source: string, partIndex: number, delta: -1 | 1): EditResult {
  const parts = new EditableSource(source).song()?.parts ?? [];
  const part = parts[partIndex];
  const other = parts[partIndex + delta];
  if (part === undefined) return failure("UNKNOWN_PART");
  if (other === undefined) return failure("INVALID_VALUE");
  const text = (range: { readonly from: number; readonly to: number }): string => source.slice(range.from, range.to);
  return applyChanges(source, [
    { from: part.from, to: part.to, insert: text(other) },
    { from: other.from, to: other.to, insert: text(part) },
  ]);
}

/** Duplicate: a copy of the part right after it ("drop 16" → "drop 16, drop 16"). */
export function duplicatePart(source: string, partIndex: number): EditResult {
  const parts = new EditableSource(source).song()?.parts ?? [];
  const part = parts[partIndex];
  if (part === undefined) return failure("UNKNOWN_PART");
  const neighbour = parts[partIndex + 1] ?? parts[partIndex - 1];
  const separator =
    neighbour === undefined
      ? PART_SEPARATOR
      : source.slice(Math.min(part.to, neighbour.to), Math.max(part.from, neighbour.from));
  return applyChanges(source, [{ from: part.to, to: part.to, insert: `${separator}${source.slice(part.from, part.to)}` }]);
}

export interface PartLength {
  readonly section: string;
  readonly bars: number;
}

function songLine(parts: readonly PartLength[]): string {
  return `song ${parts.map((part) => `${part.section} ${part.bars}`).join(PART_SEPARATOR)}`;
}

/** Where a new arrangement line goes: after the last section, else after the last track. */
function arrangementAnchor(document: EditableSource): number | null {
  const anchor = document.sections().at(-1) ?? document.tracks.at(-1)?.syntax ?? document.statements.at(-1);
  return anchor === undefined ? null : anchor.line;
}

function appendLine(document: EditableSource, line: string): TextChange {
  const anchor = arrangementAnchor(document);
  if (anchor !== null) return document.insertLineAfter(anchor, line);
  const { source } = document;
  const separator = source === "" || source.endsWith("\n") ? "" : document.lineBreak;
  return { from: source.length, to: source.length, insert: `${separator}${line}` };
}

/**
 * Writes the song the transport plays when the text has none (one part per section),
 * so the parts can be reordered, copied and resized. No change when a song exists.
 */
export function declareSong(source: string, parts: readonly PartLength[]): EditResult {
  const document = new EditableSource(source);
  if (document.song() !== null) return applyChanges(source, []);
  if (parts.length === 0) return failure("UNKNOWN_PART");
  const known = new Set(document.sections().map((section) => section.name.text));
  if (parts.some((part) => !known.has(part.section))) return failure("UNKNOWN_SECTION");
  if (parts.some((part) => !Number.isInteger(part.bars) || part.bars < MIN_PART_BARS || part.bars > MAX_PART_BARS)) {
    return failure("INVALID_VALUE");
  }
  return applyChanges(source, [appendLine(document, songLine(parts))]);
}

/**
 * Add part from what is playing: a new section with `tracks`, named "part", "part2"…,
 * and a part of `bars` at the end of the song (a song line when there is none).
 */
export function addSection(source: string, tracks: readonly string[], bars: number): NamedEditResult {
  if (!Number.isInteger(bars) || bars < MIN_PART_BARS || bars > MAX_PART_BARS) return failure("INVALID_VALUE");
  const document = new EditableSource(source);
  const names = document.trackNames();
  if (tracks.length === 0) return failure("SECTION_WOULD_BE_EMPTY");
  if (tracks.some((track) => !names.has(track))) return failure("UNKNOWN_TRACK");
  const name = nextFreeName(NEW_SECTION_NAME, new Set(document.sections().map((section) => section.name.text)));
  const sectionLine = `section ${name} ${tracks.join(" ")}`;
  const song = document.song();
  const lastPart = song?.parts.at(-1);
  if (song === null || lastPart === undefined) {
    const lines = song === null ? `${sectionLine}${document.lineBreak}${songLine([{ section: name, bars }])}` : sectionLine;
    return { ...applyChanges(source, [appendLine(document, lines)]), name };
  }
  const part: TextChange = { from: lastPart.to, to: lastPart.to, insert: `${PART_SEPARATOR}${name} ${bars}` };
  return { ...applyChanges(source, [appendLine(document, sectionLine), part]), name };
}
