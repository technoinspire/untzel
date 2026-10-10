// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Over 300 lines: the text edits of a track line (flags, parameters, steps, add, duplicate, rename, delete), each a small pure function over the same EditableSource.

import type { SyntaxNode } from "@lezer/common";
import { isWellFormedName, type InstrumentManifest, type Key, type ManifestPattern } from "@untzel/core";
import { checkName } from "../vocabulary/name-rules";
import { nextFreeName, resolveTrackNames, type TrackDeclaration } from "../vocabulary/track-names";
import { EditableSource, type NamedTrack } from "./document";
import { joinLoopSection } from "./loop-section-edits";
import { patternInKey } from "./pattern-key";
import { printNumber } from "./print";
import {
  applyChanges,
  failure,
  type EditResult,
  type NamedEditResult,
  type TextChange,
} from "./text-changes";

// Minimal edits for the track gestures of the interface.
// Each returns text changes; comments and spacing elsewhere are untouched.

function withTrack(source: string, name: string, edit: (document: EditableSource, track: NamedTrack) => EditResult): EditResult {
  const document = new EditableSource(source);
  const track = document.track(name);
  return track === null ? failure("UNKNOWN_TRACK") : edit(document, track);
}

type Flag = "mute" | "free";

function flagRemovals(document: EditableSource, track: NamedTrack, flag: Flag): TextChange[] {
  return track.syntax.modifiers
    .filter((modifier) => modifier.name.text === flag)
    .map((modifier) => document.removeModifier(modifier));
}

function muteRemovals(document: EditableSource, track: NamedTrack): TextChange[] {
  return flagRemovals(document, track, "mute");
}

/** On appends "| <flag>"; off removes every one. No change when already so. */
function setTrackFlag(source: string, track: string, flag: Flag, on: boolean): EditResult {
  return withTrack(source, track, (document, found) => {
    const isOn = found.syntax.modifiers.some((modifier) => modifier.name.text === flag);
    if (!on) return applyChanges(source, flagRemovals(document, found, flag));
    if (isOn) return applyChanges(source, []);
    return applyChanges(source, [{ from: found.syntax.to, to: found.syntax.to, insert: ` | ${flag}` }]);
  });
}

/** Mute appends "| mute"; unmute removes every "mute". No change when already there. */
export function setTrackMuted(source: string, track: string, muted: boolean): EditResult {
  return setTrackFlag(source, track, "mute", muted);
}

/**
 * Scale lock off appends "| free": the track's notes are no longer moved to the key;
 * on removes it (the note picker).
 */
export function setTrackFree(source: string, track: string, free: boolean): EditResult {
  return setTrackFlag(source, track, "free", free);
}

/** The drop gesture of loop mode: removes "mute" from every track in one edit. */
export function unmuteAllTracks(source: string): EditResult {
  const document = new EditableSource(source);
  return applyChanges(source, document.tracks.flatMap((track) => muteRemovals(document, track)));
}

/**
 * Replaces the value of the effective (last) modifier with that name, or appends
 * "| <parameter> <value>". Works for tone and every general or instrument parameter.
 */
export function setTrackParameter(source: string, track: string, parameter: string, value: number): EditResult {
  const printed = printNumber(value);
  if (printed === null) return failure("INVALID_VALUE");
  if (!isWellFormedName(parameter)) return failure("INVALID_NAME");
  return withTrack(source, track, (_, found) => {
    const existing = found.syntax.modifiers.filter((modifier) => modifier.name.text === parameter).at(-1);
    if (existing === undefined) {
      const at = found.syntax.to;
      return applyChanges(source, [{ from: at, to: at, insert: ` | ${parameter} ${printed}` }]);
    }
    if (existing.value === null) {
      return applyChanges(source, [{ from: existing.name.to, to: existing.name.to, insert: ` ${printed}` }]);
    }
    return applyChanges(source, [{ from: existing.value.from, to: existing.value.to, insert: printed }]);
  });
}

/**
 * Removes every modifier with one of these names, in one edit ("Use Tone": the written
 * parameters that override tone go, so tone shapes the sound again). No change when none
 * is written.
 */
export function removeTrackParameters(source: string, track: string, parameters: readonly string[]): EditResult {
  const names = new Set(parameters);
  return withTrack(source, track, (document, found) =>
    applyChanges(source, found.syntax.modifiers.filter((modifier) => names.has(modifier.name.text)).map((modifier) => document.removeModifier(modifier))),
  );
}

/**
 * A written value the grammar reads as one modifier value: a number, a signal with its
 * range ("sine(8) 300..2400"), a division ("1/8") or a name ("sea"). No "|", no comment,
 * no line break, so it can never add another modifier or line.
 */
const VALUE_TEXT_RULE = /^[a-z0-9.()/-]+( -?[0-9.]+\.\.-?[0-9.]+)?$/;
/** Longer than any value the grammar reads; checked first so the rule never scans a pasted wall of text. */
const VALUE_TEXT_MAX_LENGTH = 64;

/**
 * Like setTrackParameter, with the value as text: replaces the value of the effective
 * modifier or appends "| <name> <value>". A null value writes the flag ("| free").
 */
export function setTrackModifier(source: string, track: string, name: string, value: string | null): EditResult {
  if (!isWellFormedName(name)) return failure("INVALID_NAME");
  if (value !== null && (value.length > VALUE_TEXT_MAX_LENGTH || !VALUE_TEXT_RULE.test(value))) return failure("INVALID_VALUE");
  return withTrack(source, track, (_, found) => {
    const existing = found.syntax.modifiers.filter((modifier) => modifier.name.text === name).at(-1);
    const written = value === null ? "" : ` ${value}`;
    if (existing === undefined) {
      const at = found.syntax.to;
      return applyChanges(source, [{ from: at, to: at, insert: ` | ${name}${written}` }]);
    }
    if (value === null) return applyChanges(source, []);
    if (existing.value === null) return applyChanges(source, [{ from: existing.name.to, to: existing.name.to, insert: written }]);
    return applyChanges(source, [{ from: existing.value.from, to: existing.value.to, insert: value }]);
  });
}

/** The atom at a top-level step of a bar, and the step inside it for a hits token. */
export function atomAtStep(bar: SyntaxNode, step: number): { atom: SyntaxNode; offset: number } | null {
  let cursor = 0;
  for (const element of bar.getChildren("Element")) {
    const atom = element.getChild("Atom")?.firstChild ?? null;
    if (atom === null) return null;
    const width = atom.name === "Hits" ? atom.to - atom.from : 1;
    if (step < cursor + width) return { atom, offset: step - cursor };
    cursor += width;
  }
  return null;
}

function toggledHit(char: string): string {
  return char === "." ? "x" : ".";
}

/**
 * Taps a step of the grid: a hits character flips between "." and "x"; a note or chord
 * alone becomes "."; a lone "." becomes `note` when given, "x" otherwise.
 */
export function toggleStep(source: string, track: string, bar: number, step: number, note?: string): EditResult {
  return withTrack(source, track, (_, found) => {
    const barNode = found.syntax.pattern?.getChildren("Bar")[bar];
    const target = barNode === undefined ? null : atomAtStep(barNode, step);
    if (target === null) return failure("UNKNOWN_STEP");
    const { atom, offset } = target;
    if (atom.name === "Group") return failure("UNKNOWN_STEP");
    const at = atom.from + offset;
    const char = source.slice(at, at + 1);
    if (atom.name === "Hits" && (atom.to - atom.from > 1 || note === undefined || char !== ".")) {
      return applyChanges(source, [{ from: at, to: at + 1, insert: toggledHit(char) }]);
    }
    const replacement = atom.name === "Hits" ? (note ?? "x") : ".";
    return applyChanges(source, [{ from: atom.from, to: atom.to, insert: replacement }]);
  });
}

/** Where a new track line goes: after the last track, else before the arrangement. */
function newTrackChange(document: EditableSource, line: string): TextChange {
  const { statements, tracks, source } = document;
  const lastTrack = tracks.at(-1);
  if (lastTrack !== undefined) return document.insertLineAfter(lastTrack.syntax.line, line);
  const arrangement = statements.find((statement) => statement.kind === "section" || statement.kind === "song");
  if (arrangement !== undefined) return document.insertLineBefore(arrangement.line, line);
  const lastGlobal = statements.at(-1);
  if (lastGlobal !== undefined) return document.insertLineAfter(lastGlobal.line, line);
  const separator = source === "" || source.endsWith("\n") ? "" : document.lineBreak;
  return { from: source.length, to: source.length, insert: `${separator}${line}` };
}

/** Pads to a column, keeping at least one space after the text. */
function padTo(text: string, column: number): string {
  return text.padEnd(Math.max(column, text.length + 1));
}

/**
 * "<name>: <instrument> <pattern>". Aligned, the instrument and the pattern go in the
 * columns of the last named track line, so an aligned text stays aligned (the composer
 * terminal); otherwise one space apart, as the library writes it.
 */
function newTrackLine(document: EditableSource, name: string, instrument: string, pattern: string, aligned: boolean): string {
  const neighbour = document.tracks.at(-1)?.syntax;
  const head = `${name}:`;
  if (!aligned || neighbour === undefined || neighbour.name === null || neighbour.pattern === null) {
    return `${head} ${instrument} ${pattern}`;
  }
  const lineStart = document.lines.range(neighbour.line).from;
  const named = padTo(head, neighbour.instrument.from - lineStart);
  return `${padTo(`${named}${instrument}`, neighbour.pattern.from - lineStart)}${pattern}`;
}

interface NewTrack {
  readonly manifest: InstrumentManifest;
  readonly sound: string | null;
  readonly pattern: ManifestPattern | null;
  readonly key: Key | null;
  readonly aligned: boolean;
}

function insertTrack(document: EditableSource, name: string, track: NewTrack): NamedEditResult {
  const { manifest, sound, pattern, key, aligned } = track;
  if (sound !== null && !manifest.presets.some((preset) => preset.name === sound)) return failure("INVALID_NAME");
  const text = patternInKey(pattern?.text ?? manifest.defaultPattern, manifest.kind, key);
  if (text === null) return failure("INVALID_VALUE");
  // The sound word only when it is not the default one.
  const word = sound === null || sound === manifest.defaultPreset ? "" : ` ${sound}`;
  const change = newTrackChange(document, newTrackLine(document, name, `${manifest.name}${word}`, text, aligned));
  return { ...applyChanges(document.source, [change, ...joinLoopSection(document, name)]), name };
}

/**
 * Inserts "<name>: <instrument> [<sound>] <pattern>" with the next free name, and puts the
 * name in the loop section when there is one (a new track is never silent in loop mode).
 * The pattern is one of the manifest's (the first when null), already in the music's key.
 */
export function addTrack(
  source: string,
  manifest: InstrumentManifest,
  sound: string | null = null,
  pattern: ManifestPattern | null = null,
  key: Key | null = null,
): NamedEditResult {
  const document = new EditableSource(source);
  return insertTrack(document, nextFreeName(manifest.name, document.trackNames()), { manifest, sound, pattern, key, aligned: false });
}

/**
 * The composer terminal's add: the name it was given (or the next free one), in the
 * columns of the track above; one inserted line, plus the loop section as addTrack.
 */
export function addNamedTrack(source: string, manifest: InstrumentManifest, name: string, key: Key | null = null): NamedEditResult {
  const document = new EditableSource(source);
  const problem = checkName(name, document.trackNames());
  if (problem !== null) return failure(problem);
  return insertTrack(document, name, { manifest, sound: null, pattern: null, key, aligned: true });
}

/**
 * Copies the track line under it with the next free name (bass -> bass2, hat2 -> hat3),
 * in the loop section too when there is one.
 */
export function duplicateTrack(source: string, track: string): NamedEditResult {
  const document = new EditableSource(source);
  const found = document.track(track);
  if (found === null) return failure("UNKNOWN_TRACK");
  const base = withoutTrailingDigits(track) || track;
  const name = nextFreeName(base, document.trackNames());
  if (!isWellFormedName(name)) return failure("INVALID_NAME");
  const { syntax } = found;
  // The whole physical line, so a trailing comment is copied too.
  const lineEnd = document.lines.range(syntax.line).to;
  const rest = source.slice(syntax.name === null ? syntax.instrument.from : syntax.name.to, lineEnd);
  const copy = syntax.name === null ? `${name}: ${rest}` : `${name}${rest}`;
  return { ...applyChanges(source, [document.insertLineAfter(syntax.line, copy), ...joinLoopSection(document, name)]), name };
}

/**
 * Unnamed tracks whose automatic name would change after an edit get their current
 * name written, so sections that use it keep working.
 */
export function pinShiftedNames(
  document: EditableSource,
  edited: NamedTrack,
  after: (track: NamedTrack) => TrackDeclaration | null,
): TextChange[] {
  const remaining = document.tracks.flatMap((track) => {
    const declaration = after(track);
    return declaration === null ? [] : [{ track, declaration }];
  });
  const names = resolveTrackNames(remaining.map((entry) => entry.declaration));
  return remaining.flatMap(({ track }, index) => {
    if (track === edited || track.syntax.name !== null || names[index] === track.name) return [];
    const at = track.syntax.instrument.from;
    return [{ from: at, to: at, insert: `${track.name}: ` }];
  });
}

export function declarationOf(track: NamedTrack): TrackDeclaration {
  return { name: track.syntax.name, instrument: track.syntax.instrument.text };
}

/** Renames the track and every reference in sections, in one edit. */
export function renameTrack(source: string, track: string, newName: string): EditResult {
  return withTrack(source, track, (document, found) => {
    if (newName === track) return applyChanges(source, []);
    const problem = checkName(newName, document.trackNames());
    if (problem !== null) return failure(problem);
    const { syntax } = found;
    const own: TextChange =
      syntax.name === null
        ? { from: syntax.instrument.from, to: syntax.instrument.from, insert: `${newName}: ` }
        : { from: syntax.name.from, to: syntax.name.to, insert: newName };
    const renamedToken = { text: newName, from: 0, to: 0 };
    const pins = pinShiftedNames(document, found, (candidate) =>
      candidate === found ? { name: renamedToken, instrument: syntax.instrument.text } : declarationOf(candidate),
    );
    const references = document.sections().flatMap((section) =>
      section.tracks.filter((token) => token.text === track).map((token) => ({ from: token.from, to: token.to, insert: newName })),
    );
    return applyChanges(source, [own, ...pins, ...references]);
  });
}

/** Removes the track line and its name from every section, in one edit. */
export function deleteTrack(source: string, track: string): EditResult {
  return withTrack(source, track, (document, found) => {
    const sections = document.sections().filter((section) => section.tracks.some((token) => token.text === track));
    if (sections.some((section) => section.tracks.every((token) => token.text === track))) {
      return failure("SECTION_WOULD_BE_EMPTY");
    }
    const references = sections.map((section) => document.rewriteSectionTracks(section, (token) => token.text !== track));
    const pins = pinShiftedNames(document, found, (candidate) => (candidate === found ? null : declarationOf(candidate)));
    return applyChanges(source, [document.removeLine(found.syntax.line), ...pins, ...references]);
  });
}
/** "hat23" -> "hat", in one pass: /\d+$/ retried from every digit of a long run. */
function withoutTrailingDigits(name: string): string {
  let end = name.length;
  while (end > 0 && name.charCodeAt(end - 1) >= 48 && name.charCodeAt(end - 1) <= 57) end -= 1;
  return name.slice(0, end);
}
