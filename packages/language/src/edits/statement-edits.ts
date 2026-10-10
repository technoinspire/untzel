// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { SCALE_NAMES, isWellFormedName } from "@untzel/core";
import { MAX_PART_BARS, MAX_TEMPO, MIN_PART_BARS, MIN_TEMPO } from "../limits";
import type { StatementSyntax } from "../highlight/outline";
import { EditableSource } from "./document";
import { printNumber } from "./print";
import { applyChanges, failure, type EditResult, type TextChange } from "./text-changes";

// Minimal edits for the song statements: tempo, key, a section's tracks and the song.
// Only the touched tokens change; a missing statement is inserted as its own line where
// the language expects it. The composer terminal writes setSection and setSong; their
// names go through isWellFormedName from @untzel/core, the one name shape.

const TONIC_RULE = /^[a-g][b#]?$/;

/** A new line after the last statement of these kinds, else before the first other one. */
function insertLine(document: EditableSource, line: string, after: ReadonlySet<StatementSyntax["kind"]>): TextChange {
  const { statements, source } = document;
  const anchor = statements.filter((statement) => after.has(statement.kind)).at(-1);
  if (anchor !== undefined) return document.insertLineAfter(anchor.line, line);
  const first = statements.find((statement) => !after.has(statement.kind));
  if (first !== undefined) return document.insertLineBefore(first.line, line);
  const separator = source === "" || source.endsWith("\n") ? "" : document.lineBreak;
  return { from: source.length, to: source.length, insert: `${separator}${line}` };
}

/** Replaces the tempo value, or writes "tempo <bpm>" before everything else. */
export function setTempo(source: string, bpm: number): EditResult {
  const printed = printNumber(bpm);
  if (printed === null || bpm < MIN_TEMPO || bpm > MAX_TEMPO) return failure("INVALID_VALUE");
  const document = new EditableSource(source);
  const tempo = document.statements.find((statement) => statement.kind === "tempo");
  if (tempo !== undefined) return applyChanges(source, [{ from: tempo.value.from, to: tempo.value.to, insert: printed }]);
  return applyChanges(source, [insertLine(document, `tempo ${printed}`, new Set())]);
}

/** Replaces tonic and scale, or writes "key <tonic> <scale>" after the tempo. */
export function setKey(source: string, tonic: string, scale: string): EditResult {
  if (!TONIC_RULE.test(tonic) || !SCALE_NAMES.some((name) => name === scale)) return failure("INVALID_VALUE");
  const document = new EditableSource(source);
  const key = document.statements.find((statement) => statement.kind === "key");
  if (key !== undefined) {
    return applyChanges(source, [
      { from: key.tonic.from, to: key.tonic.to, insert: tonic },
      { from: key.scale.from, to: key.scale.to, insert: scale },
    ]);
  }
  return applyChanges(source, [insertLine(document, `key ${tonic} ${scale}`, new Set(["tempo"]))]);
}

/** Replaces the tracks of a section, or adds "section <name> <tracks>" after the last one. */
export function setSection(source: string, name: string, tracks: readonly string[]): EditResult {
  if (!isWellFormedName(name) || tracks.length === 0) return failure("INVALID_NAME");
  const document = new EditableSource(source);
  const names = document.trackNames();
  if (tracks.some((track) => !names.has(track))) return failure("UNKNOWN_TRACK");
  const list = [...new Set(tracks)].join(" ");
  const found = document.sections().find((section) => section.name.text === name);
  const first = found?.tracks[0];
  const last = found?.tracks.at(-1);
  if (first !== undefined && last !== undefined) {
    return applyChanges(source, [{ from: first.from, to: last.to, insert: list }]);
  }
  return applyChanges(source, [insertLine(document, `section ${name} ${list}`, new Set(["tempo", "key", "swing", "loop", "track", "section"]))]);
}

export interface SongPartText {
  readonly section: string;
  readonly bars: number;
}

/** Replaces the parts of the song, keeping "| loop", or writes "song …" at the end. */
export function setSong(source: string, parts: readonly SongPartText[]): EditResult {
  if (parts.length === 0) return failure("INVALID_VALUE");
  if (parts.some((part) => !Number.isInteger(part.bars) || part.bars < MIN_PART_BARS || part.bars > MAX_PART_BARS)) {
    return failure("INVALID_VALUE");
  }
  const document = new EditableSource(source);
  const sections = new Set(document.sections().map((section) => section.name.text));
  if (parts.some((part) => !sections.has(part.section))) return failure("UNKNOWN_SECTION");
  const text = parts.map((part) => `${part.section} ${part.bars}`).join(", ");
  const song = document.song();
  const first = song?.parts[0];
  const last = song?.parts.at(-1);
  if (first !== undefined && last !== undefined) return applyChanges(source, [{ from: first.from, to: last.to, insert: text }]);
  return applyChanges(source, [insertLine(document, `song ${text}`, new Set(["tempo", "key", "swing", "loop", "track", "section", "song"]))]);
}
