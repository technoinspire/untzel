// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Rational, Section, Song, SongPart } from "@untzel/core";
import type { DiagnosticList } from "../diagnostics/diagnostics";
import { MAX_NAME_LENGTH, MAX_PART_BARS, MIN_PART_BARS } from "../limits";
import type { LineIndex } from "./lines";
import { changeEveryFix, renameFix, suggestionFix } from "../diagnostics/fixes";
import { messages } from "../copy/messages";
import type { ModifierSyntax, SectionSyntax, SongSyntax, Token } from "../highlight/outline";
import { TEMPO_RULE } from "./read-globals";
import { warnDuplicates } from "./read-modifiers";
import { exactNumber, readConstant, readNumericValue, type NumericRule } from "./read-values";
import { closest } from "../diagnostics/suggest";
import { nextFreeName } from "../vocabulary/track-names";

export const SECTION_GAIN_RULE: NumericRule = {
  name: "gain",
  min: 0,
  max: 1,
  integer: false,
  allowsSignal: false,
  example: "gain 0.8",
};

const PART_BARS_RULE: NumericRule = {
  name: "bars",
  min: MIN_PART_BARS,
  max: MAX_PART_BARS,
  integer: true,
  allowsSignal: false,
  example: "drop 16",
};

/** Every written copy of each unknown name, so one fix can change them all. */
function copiesOf(tokens: readonly Token[], known: ReadonlySet<string>): ReadonlyMap<string, readonly Token[]> {
  const copies = new Map<string, Token[]>();
  for (const token of tokens) {
    if (known.has(token.text)) continue;
    copies.set(token.text, [...(copies.get(token.text) ?? []), token]);
  }
  return copies;
}

export function checkNameLength(name: Token, diagnostics: DiagnosticList): void {
  if (name.text.length > MAX_NAME_LENGTH) {
    diagnostics.error("NAME_TOO_LONG", messages.nameTooLong(MAX_NAME_LENGTH), name);
  }
}

function readSectionModifiers(
  modifiers: readonly ModifierSyntax[],
  diagnostics: DiagnosticList,
): { tempo: Rational | null; gain: number; isLoop: boolean } {
  warnDuplicates(modifiers, diagnostics);
  let tempo: Rational | null = null;
  let gain = 1;
  let isLoop = false;
  for (const modifier of modifiers) {
    const name = modifier.name.text;
    if (name === "loop") {
      if (modifier.value !== null) diagnostics.error("OUT_OF_RANGE", messages.noValue(name), modifier.value);
      else isLoop = true;
      continue;
    }
    if (name === "tempo" || name === "gain") {
      const rule = name === "tempo" ? TEMPO_RULE : SECTION_GAIN_RULE;
      const value = readNumericValue(modifier, rule, diagnostics);
      if (value?.kind !== "constant" || modifier.value?.kind !== "number") continue;
      if (name === "tempo") tempo = exactNumber(modifier.value.number);
      else gain = value.value;
      continue;
    }
    const suggestion = closest(name, ["tempo", "gain", "loop"]);
    const message = messages.unknownSectionModifier(name, suggestion?.text ?? null);
    diagnostics.error("UNKNOWN_MODIFIER", message, modifier.name, suggestionFix(modifier.name, suggestion));
  }
  return { tempo, gain, isLoop };
}

/** Sections in text order; every listed track must exist. */
export function readSections(
  sections: readonly SectionSyntax[],
  trackNames: ReadonlySet<string>,
  lines: LineIndex,
  diagnostics: DiagnosticList,
): readonly Section[] {
  const first = new Map<string, SectionSyntax>();
  let loopSection: SectionSyntax | null = null;
  const taken = new Set(sections.map((section) => section.name.text));
  const unknown = copiesOf(sections.flatMap((section) => section.tracks), trackNames);
  return sections.map((section) => {
    checkNameLength(section.name, diagnostics);
    const earlier = first.get(section.name.text);
    if (earlier === undefined) first.set(section.name.text, section);
    else {
      const message = messages.duplicateSection(section.name.text, lines.lineNumber(earlier.from));
      const next = nextFreeName(section.name.text, taken);
      taken.add(next);
      diagnostics.error("DUPLICATE_SECTION_NAME", message, section.name, renameFix(section.name, next));
    }
    for (const track of section.tracks) {
      const copies = unknown.get(track.text);
      if (copies === undefined) continue;
      const suggestion = closest(track.text, trackNames);
      const message = messages.unknownTrack(section.name.text, track.text, suggestion?.text ?? null);
      diagnostics.error("UNKNOWN_TRACK", message, track, changeEveryFix(copies, suggestion));
    }
    const tracks = [...new Set(section.tracks.map((track) => track.text))];
    const modifiers = readSectionModifiers(section.modifiers, diagnostics);
    if (modifiers.isLoop && loopSection !== null) {
      const line = lines.lineNumber(loopSection.from);
      const anchor = section.modifiers.find((modifier) => modifier.name.text === "loop") ?? section.name;
      diagnostics.error("DUPLICATE_LOOP_SECTION", messages.duplicateLoopSection(loopSection.name.text, line), anchor);
    } else if (modifiers.isLoop) {
      loopSection = section;
    }
    return { name: section.name.text, tracks, ...modifiers };
  });
}

function readPart(
  part: SongSyntax["parts"][number],
  sectionNames: ReadonlySet<string>,
  unknown: ReadonlyMap<string, readonly Token[]>,
  diagnostics: DiagnosticList,
): SongPart | null {
  const copies = unknown.get(part.section.text);
  const known = copies === undefined;
  if (copies !== undefined) {
    const suggestion = closest(part.section.text, sectionNames);
    const message = messages.unknownSection(part.section.text, suggestion?.text ?? null);
    diagnostics.error("UNKNOWN_SECTION", message, part.section, changeEveryFix(copies, suggestion));
  }
  const bars = readConstant(part.bars, PART_BARS_RULE, diagnostics, messages.partBars(MIN_PART_BARS, MAX_PART_BARS));
  return known && bars !== null ? { section: part.section.text, bars } : null;
}

/** The single song; any other one is DUPLICATE_SONG. */
export function readSong(
  songs: readonly SongSyntax[],
  sectionNames: ReadonlySet<string>,
  diagnostics: DiagnosticList,
): Song | null {
  const [song, ...others] = songs;
  for (const other of others) diagnostics.error("DUPLICATE_SONG", messages.duplicateSong(), other.head);
  if (song === undefined) return null;
  const unknown = copiesOf(song.parts.map((part) => part.section), sectionNames);
  const parts = song.parts.flatMap((part) => {
    const read = readPart(part, sectionNames, unknown, diagnostics);
    return read === null ? [] : [read];
  });
  return { parts, loop: song.loop };
}
