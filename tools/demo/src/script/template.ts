// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentManifest, InstrumentRegistry, Program, Section, Track } from "@untzel/core";
import { analyze, type Diagnostic } from "@untzel/language";
import { serialize } from "./program-equality";

// A template read for the demo: the analyzed program plus the written text of what no
// edit function produces (global lines, section modifiers, the song line, modifier
// values). The language parses; this file only slices the lines the program points at.

export interface WrittenModifier {
  readonly name: string;
  /** The value as written ("0.3", "sine(8) 300..1400", "sea"); null for a flag. */
  readonly value: string | null;
}

export interface TemplateTrack {
  readonly track: Track;
  readonly manifest: InstrumentManifest;
  readonly modifiers: readonly WrittenModifier[];
  /** The pattern as written, from the first bar to the last. */
  readonly patternText: string;
  /** The track's line as written, without its comment. */
  readonly statement: string;
}

export interface TemplateSection {
  readonly section: Section;
  /** "| tempo 140 | gain 0.8" as written, or "". */
  readonly modifiersText: string;
}

export interface TemplateModel {
  readonly program: Program;
  /** title, tempo, key and swing lines whose value differs from an empty text. */
  readonly globalLines: readonly string[];
  readonly tracks: readonly TemplateTrack[];
  readonly sections: readonly TemplateSection[];
  readonly songLine: string | null;
}

export type TemplateResult =
  | { readonly ok: true; readonly template: TemplateModel }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** The statement of a line: without the comment and the outer spaces. */
export function statementText(line: string): string {
  const comment = line.indexOf("//");
  return (comment < 0 ? line : line.slice(0, comment)).trim();
}

function firstWord(statement: string): string {
  return statement.split(/\s+/, 1)[0] ?? "";
}

/** The modifiers of a statement as written, left to right. */
export function readModifiers(statement: string): WrittenModifier[] {
  return statement
    .split("|")
    .slice(1)
    .map((part) => part.trim())
    .map((part) => {
      const name = firstWord(part);
      const value = part.slice(name.length).trim();
      return { name, value: value === "" ? null : value };
    });
}

function readTrack(source: string, track: Track, registry: InstrumentRegistry): TemplateTrack {
  const manifest = registry.get(track.instrument);
  if (manifest === undefined) throw new Error(`no manifest for instrument "${track.instrument}"`);
  const first = track.pattern.bars[0];
  const last = track.pattern.bars.at(-1);
  const patternText = first === undefined || last === undefined ? "" : source.slice(first.source.from, last.source.to);
  const statement = statementText(source.slice(track.source.from, track.source.to));
  return { track, manifest, modifiers: readModifiers(statement), patternText, statement };
}

/** The last statement line that starts with `keyword`. */
function lastStatement(statements: readonly string[], keyword: string): string | null {
  return statements.filter((statement) => firstWord(statement) === keyword).at(-1) ?? null;
}

/** Only globals an empty text does not already have get typed. */
function changedGlobals(statements: readonly string[], program: Program, empty: Program): string[] {
  const keywords = (["title", "tempo", "key", "swing"] as const).filter(
    (keyword) => serialize(program[keyword]) !== serialize(empty[keyword]),
  );
  return keywords.flatMap((keyword) => {
    const line = lastStatement(statements, keyword);
    return line === null ? [] : [line];
  });
}

function readSections(statements: readonly string[], program: Program): TemplateSection[] {
  return program.sections.map((section) => {
    const line = statements.find((statement) => {
      const words = statement.split(/\s+/);
      return words[0] === "section" && words[1] === section.name;
    });
    const bar = line?.indexOf("|") ?? -1;
    return { section, modifiersText: line === undefined || bar < 0 ? "" : line.slice(bar) };
  });
}

/** Reads `source` with the real parser; fails with its diagnostics when it does not play. */
export function readTemplate(source: string, registry: InstrumentRegistry): TemplateResult {
  const analysis = analyze(source, registry);
  if (!analysis.ok) return { ok: false, diagnostics: analysis.diagnostics };
  const empty = analyze("", registry);
  if (!empty.ok) throw new Error("an empty text must analyze");
  const { program } = analysis;
  const statements = source
    .split(/\r?\n/)
    .map(statementText)
    .filter((statement) => statement !== "");
  return {
    ok: true,
    template: {
      program,
      globalLines: changedGlobals(statements, program, empty.program),
      tracks: program.tracks.map((track) => readTrack(source, track, registry)),
      sections: readSections(statements, program),
      songLine: lastStatement(statements, "song"),
    },
  };
}
