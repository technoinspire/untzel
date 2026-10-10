// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Tree } from "@lezer/common";
import {
  instrumentNames,
  presetOf,
  resolveTrackModulators,
  resolveTrackParameters,
  sourceHash,
  type InstrumentManifest,
  type InstrumentRegistry,
  type Program,
  type Track,
} from "@untzel/core";
import type { DiagnosticList, DiagnosticMessage } from "../diagnostics/diagnostics";
import { lightSourceHash, stagePlanHash } from "../highlight/light-source";
import { LineIndex } from "./lines";
import { patternFix, suggestionFix, valueFix } from "../diagnostics/fixes";
import { messages } from "../copy/messages";
import { noteFix } from "../vocabulary/note-spelling";
import {
  readOutline,
  type SectionSyntax,
  type SongSyntax,
  type StatementSyntax,
  type TrackSyntax,
} from "../highlight/outline";
import { checkNameLength, readSections, readSong } from "./read-arrangement";
import { readGlobals } from "./read-globals";
import { readTitle } from "./read-title";
import { readTrackModifiers } from "./read-modifiers";
import { readPattern } from "./read-pattern";
import { closest } from "../diagnostics/suggest";
import { findSyntaxErrors, type ErroredLines } from "./syntax-errors";
import { reportDuplicateTrackNames, resolveTrackNames } from "../vocabulary/track-names";
import type { Token } from "../highlight/outline";

/** A word after the instrument that reads like a note with a wrong letter ("h2"). */
const NOTE_LIKE = /^[h-z][b#]?\d$/;

/** A track line read into the model, or null when it has an error. */
interface TrackReading {
  readonly track: Track | null;
  readonly seedDependent: boolean;
}

const RANK: Readonly<Record<StatementSyntax["kind"], number>> = {
  title: 0,
  tempo: 0,
  key: 0,
  swing: 0,
  loop: 0,
  track: 1,
  section: 2,
  song: 3,
};

/** A keyword alone on a line parses as a track named after it (MISSING_VALUE). */
const KEYWORD_EXAMPLES: Readonly<Record<string, string>> = {
  title: 'title "Midnight Coast"',
  tempo: "tempo 132",
  key: "key c minor",
  swing: "swing 0.12",
  loop: "loop 8",
  section: "section drop kick hat",
  song: "song intro 8, drop 16",
};

/** The keywords whose example `fix` may write: section and song would name tracks and sections. */
const FIXABLE_KEYWORDS: ReadonlySet<string> = new Set(["title", "tempo", "key", "swing", "loop"]);

function isTrack(statement: StatementSyntax): statement is TrackSyntax {
  return statement.kind === "track";
}

function isSection(statement: StatementSyntax): statement is SectionSyntax {
  return statement.kind === "section";
}

function isSong(statement: StatementSyntax): statement is SongSyntax {
  return statement.kind === "song";
}

function isKeywordAlone(statement: TrackSyntax): boolean {
  return (
    statement.name === null &&
    statement.pattern === null &&
    statement.preset === null &&
    statement.instrument.text in KEYWORD_EXAMPLES
  );
}

/** "tempo fast": a statement keyword used as an instrument with a sound. */
function isKeywordWithSound(statement: TrackSyntax): boolean {
  return statement.name === null && statement.preset !== null && statement.instrument.text in KEYWORD_EXAMPLES;
}

function outOfOrderMessage(statement: StatementSyntax): DiagnosticMessage {
  if (RANK[statement.kind] === 0) return messages.globalsFirst(statement.kind);
  return statement.kind === "track" ? messages.tracksBeforeSections() : messages.sectionsBeforeSong();
}

function checkOrder(statements: readonly StatementSyntax[], diagnostics: DiagnosticList): void {
  let highest = 0;
  for (const statement of statements) {
    const rank = RANK[statement.kind];
    if (rank < highest) diagnostics.error("OUT_OF_ORDER", outOfOrderMessage(statement), statement.head);
    highest = Math.max(highest, rank);
  }
}

/** On a line with a syntax error, a name written before the error still counts. */
function declaredBeforeError(statement: StatementSyntax, errored: ErroredLines): boolean {
  const errorAt = errored.get(statement.line) ?? 0;
  if (statement.kind === "track") return statement.name !== null && statement.name.to <= errorAt;
  return statement.kind === "section" && statement.name.to <= errorAt;
}

class ProgramBuilder {
  readonly #source: string;
  readonly #registry: InstrumentRegistry;
  readonly #diagnostics: DiagnosticList;
  readonly #lines: LineIndex;

  constructor(source: string, registry: InstrumentRegistry, diagnostics: DiagnosticList) {
    this.#source = source;
    this.#registry = registry;
    this.#diagnostics = diagnostics;
    this.#lines = new LineIndex(source);
  }

  build(tree: Tree): Program | null {
    const diagnostics = this.#diagnostics;
    const instruments = new Set(instrumentNames(this.#registry));
    const errored = findSyntaxErrors(tree, this.#source, this.#lines, diagnostics, instruments);
    const statements = readOutline(tree, this.#source, this.#lines);
    const valid = statements.filter((statement) => !errored.has(statement.line));
    const declared = statements.filter((statement) => errored.has(statement.line) && declaredBeforeError(statement, errored));
    checkOrder(valid, diagnostics);
    const globals = readGlobals(valid, this.#lines, diagnostics);
    const title = readTitle(valid, this.#lines, diagnostics);
    const tracks = this.#trackStatements(valid);
    const names = this.#trackNames([...tracks, ...declared.filter(isTrack)]);
    const readings = tracks.map((track) => this.#track(track, names.get(track) ?? track.instrument.text));
    const sectionSyntax = valid.filter(isSection);
    const sections = readSections(sectionSyntax, new Set(names.values()), this.#lines, diagnostics);
    const sectionNames = new Set([...sectionSyntax, ...declared.filter(isSection)].map((section) => section.name.text));
    const song = readSong(valid.filter(isSong), sectionNames, diagnostics);
    if (diagnostics.hasErrors()) return null;
    return {
      title,
      ...globals,
      tracks: readings.flatMap((reading) => (reading.track === null ? [] : [reading.track])),
      sections,
      song,
      sourceHash: sourceHash(this.#source),
      lightSourceHash: lightSourceHash(this.#source),
      stagePlanHash: stagePlanHash(this.#source),
      seedDependent: readings.some((reading) => reading.seedDependent),
    };
  }

  /** Names of every declared track, valid or on a line with a syntax error. */
  #trackNames(tracks: readonly TrackSyntax[]): ReadonlyMap<TrackSyntax, string> {
    const ordered = [...tracks].sort((a, b) => a.from - b.from);
    const declarations = ordered.map((track) => ({ name: track.name, instrument: track.instrument.text }));
    reportDuplicateTrackNames(declarations, this.#lines, this.#diagnostics);
    const names = resolveTrackNames(declarations);
    return new Map(ordered.map((track, index) => [track, names[index] ?? track.instrument.text]));
  }

  /** Track statements, minus keywords written alone (MISSING_VALUE). */
  #trackStatements(statements: readonly StatementSyntax[]): readonly TrackSyntax[] {
    return statements.filter((statement): statement is TrackSyntax => {
      if (statement.kind !== "track") return false;
      if (isKeywordWithSound(statement) && statement.preset !== null) {
        this.#diagnostics.error("SYNTAX_ERROR", messages.keywordWithSound(statement.instrument.text), statement.preset);
        return false;
      }
      if (!isKeywordAlone(statement)) return true;
      const word = statement.instrument.text;
      const example = KEYWORD_EXAMPLES[word] ?? word;
      const fix = FIXABLE_KEYWORDS.has(word) ? valueFix(statement.instrument, example) : null;
      this.#diagnostics.error("MISSING_VALUE", messages.missingValue(word, example), statement.instrument, fix);
      return false;
    });
  }

  // Over 40 lines: one track read in the order its diagnostics must come.
  #track(syntax: TrackSyntax, name: string): TrackReading {
    const diagnostics = this.#diagnostics;
    if (syntax.name !== null) checkNameLength(syntax.name, diagnostics);
    const instrument = syntax.instrument.text;
    const manifest = this.#registry.get(instrument) ?? null;
    if (manifest === null) {
      const suggestion = closest(instrument, instrumentNames(this.#registry));
      const message = messages.unknownInstrument(instrument, suggestion?.text ?? null);
      diagnostics.error("UNKNOWN_INSTRUMENT", message, syntax.instrument, suggestionFix(syntax.instrument, suggestion));
    }
    const preset = this.#preset(syntax.preset, manifest);
    if (syntax.pattern === null && !preset.noteLike) {
      // The instrument's first pattern, after its sound when one is written.
      const fix = manifest === null ? null : patternFix(syntax.preset ?? syntax.instrument, manifest.defaultPattern);
      diagnostics.error("EMPTY_PATTERN", messages.emptyPattern(), syntax.instrument, fix);
    }
    const pattern = syntax.pattern === null ? null : readPattern(syntax.pattern, this.#source, manifest, diagnostics);
    const modifiers = readTrackModifiers(syntax.modifiers, manifest, instrument, diagnostics, preset.values);
    const seedDependent = (pattern?.usesProbability ?? false) || modifiers.usesRandom;
    if (manifest === null || pattern === null) return { track: null, seedDependent };
    const track: Track = {
      name,
      instrument,
      pattern: pattern.spec,
      muted: modifiers.muted,
      free: modifiers.free,
      transpose: modifiers.transpose,
      swing: modifiers.swing,
      shift: modifiers.shift,
      preset: preset.name,
      velocity: modifiers.velocity,
      legato: modifiers.legato,
      voicing: modifiers.voicing,
      inversion: modifiers.inversion,
      arp: modifiers.arp,
      effects: modifiers.effects,
      modulators: resolveTrackModulators(modifiers.written, manifest),
      parameters: resolveTrackParameters(modifiers.written, manifest),
      source: this.#lines.range(syntax.line),
    };
    return { track, seedDependent: seedDependent || modifiers.arp?.mode === "random" };
  }

  /**
   * The named sound: its values, or UNKNOWN_PRESET. The default sound reads as null. A
   * word like "h2" is a note with a wrong letter, not a sound (INVALID_NOTE).
   */
  #preset(
    token: Token | null,
    manifest: InstrumentManifest | null,
  ): { readonly name: string | null; readonly values: Readonly<Record<string, number>>; readonly noteLike: boolean } {
    const none = { name: null, values: {}, noteLike: false };
    if (token === null) return none;
    if (NOTE_LIKE.test(token.text)) {
      const { suggestion, fix } = noteFix(token);
      this.#diagnostics.error("INVALID_NOTE", messages.invalidNote(token.text, suggestion), token, fix);
      return { ...none, noteLike: true };
    }
    if (manifest === null) return none;
    const preset = presetOf(manifest, token.text);
    if (preset === undefined) {
      const suggestion = closest(token.text, manifest.presets.map((candidate) => candidate.name));
      const message = messages.unknownPreset(manifest.name, token.text, suggestion?.text ?? null);
      this.#diagnostics.error("UNKNOWN_PRESET", message, token, suggestionFix(token, suggestion));
      return none;
    }
    return { name: preset.name === manifest.defaultPreset ? null : preset.name, values: preset.values, noteLike: false };
  }
}

/** Syntax and semantics of a parsed source; null when any error was reported. */
export function treeToProgram(
  source: string,
  tree: Tree,
  registry: InstrumentRegistry,
  diagnostics: DiagnosticList,
): Program | null {
  return new ProgramBuilder(source, registry, diagnostics).build(tree);
}
