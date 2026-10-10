// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { midiToNoteName, pitchClassName, scalePitchClasses, tonicToPitchClass, type Key, type ScaleName } from "@untzel/core";
import { instrumentDetail, parameterDetail, parameterWithValue, signalExample } from "../proposal/describe";
import type { Describer } from "../proposal/describer";
import type { Completion } from "./line-completion";
import { assistStrings as say } from "../copy/copy";
import { SCALES, SIGNAL_SHAPES, STATEMENT_WORDS, TONICS, type Vocabulary } from "../reading/vocabulary";

// What the code editor completes and explains under the cursor, read from the line being
// written, the registry and the grammar's lists. Works on text with errors: nothing here
// needs a valid program.

export interface CodeCompletion {
  /** Offset in the source where the word being written starts. */
  readonly from: number;
  readonly options: readonly Completion[];
  /**
   * Steps of a pattern: offered on Ctrl+Space only, so writing "x..." never opens a
   * list that Enter would accept instead of breaking the line.
   */
  readonly explicitOnly: boolean;
}

export interface HoverHelp {
  readonly from: number;
  readonly to: number;
  /** The first line is the title. */
  readonly lines: readonly string[];
}

const WORD_TAIL = /[A-Za-z0-9_#.()/~-]*$/;
const WORD_AT = /[A-Za-z0-9_#()-]+/g;
const DRUM_PATTERNS = ["x...", "x.x.", "..x.", "X...", "...."];

/** The usage of a statement word, for completion and hover; undefined for other words. */
function statementDetail(word: string): string | undefined {
  switch (word) {
    case "title":
      return say.statementTitle;
    case "tempo":
      return say.statementTempo;
    case "key":
      return say.statementKey;
    case "swing":
      return say.statementSwing;
    case "loop":
      return say.statementLoop;
    case "section":
      return say.statementSection;
    case "song":
      return say.statementSong;
    default:
      return undefined;
  }
}

function lineBounds(source: string, offset: number): { start: number; end: number } {
  const start = source.lastIndexOf("\n", offset - 1) + 1;
  const newline = source.indexOf("\n", offset);
  return { start, end: newline === -1 ? source.length : newline };
}

/** The key the text declares, else the language's default (c minor). */
function keyOf(source: string): Key {
  const match = /^[ \t]*key[ \t]+([a-g][b#]?)[ \t]+([a-z]+)/m.exec(source);
  const tonic = match === null ? 0 : (tonicToPitchClass(match[1] ?? "") ?? 0);
  const scale = SCALES.find((name) => name === match?.[2]) as ScaleName | undefined;
  return { tonic, scale: scale ?? "minor" };
}

function notesOf(key: Key): Completion[] {
  const classes = scalePitchClasses(key);
  // Upwards from the tonic in octaves 1 to 3, the bass and lead registers.
  const notes = [1, 2, 3].flatMap((octave) =>
    classes
      .map((pitchClass) => midiToNoteName(12 * (octave + 1) + key.tonic + ((pitchClass - key.tonic + 12) % 12)))
      .filter((note): note is string => note !== null),
  );
  return [...notes.map((label) => ({ label, detail: say.note })), { label: ".", detail: say.rest }, { label: "~", detail: say.hold }];
}

/** Triads on each degree of the key: "Cm", "Eb", "Fm"… (major and minor only). */
function chordsOf(key: Key): Completion[] {
  const classes = scalePitchClasses(key);
  if (classes.length !== 7) return [];
  return classes.map((root, degree) => {
    const third = ((classes[(degree + 2) % 7] ?? 0) - root + 12) % 12;
    const name = pitchClassName(root);
    const label = `${name.charAt(0).toUpperCase()}${name.slice(1)}${third === 3 ? "m" : ""}`;
    return { label, detail: say.chord };
  });
}

/** After the instrument of a track line and before its first "|": the steps. */
function inPattern(head: string): boolean {
  const words = head.trim().split(/\s+/).filter((entry) => entry !== "");
  const [first] = words;
  if (first === undefined || STATEMENT_WORDS.includes(first) || head.includes("|")) return false;
  return words.length >= (first.endsWith(":") ? 2 : 1);
}

export class CodeAssist {
  readonly #vocabulary: Vocabulary;
  readonly #describer: Describer;

  constructor(vocabulary: Vocabulary, describer: Describer) {
    this.#vocabulary = vocabulary;
    this.#describer = describer;
  }

  /** Null where nothing fits: inside a comment, a number or a name being declared. */
  complete(source: string, offset: number): CodeCompletion | null {
    const { start } = lineBounds(source, offset);
    const before = source.slice(start, offset);
    if (before.includes("//")) return null;
    const word = WORD_TAIL.exec(before)?.[0] ?? "";
    const from = offset - word.length;
    const head = before.slice(0, before.length - word.length);
    const options = this.#optionsFor(source, head).filter((option) => option.label.startsWith(word));
    return options.length === 0 ? null : { from, options, explicitOnly: inPattern(head) };
  }

  #optionsFor(source: string, head: string): Completion[] {
    const words = head.trim().split(/\s+/).filter((entry) => entry !== "");
    const [first] = words;
    if (first === undefined) return this.#lineStart();
    switch (first) {
      case "key":
        if (words.length === 1) return TONICS.map((label) => ({ label, detail: say.tonic }));
        return words.length === 2 ? SCALES.map((label) => ({ label, detail: say.scale })) : [];
      case "section":
        if (head.includes("|")) return [{ label: "tempo", detail: say.tempoRange }, { label: "gain", detail: say.sectionGain }];
        return words.length >= 2 ? this.#tracks(source) : [];
      case "song":
        return /(song|,)\s*$/.test(head) ? this.#sections(source) : [];
      // The song's name is free text between quotes: nothing to suggest inside it.
      case "title":
      case "tempo":
      case "swing":
      case "loop":
        return [];
      default:
        return this.#trackLine(source, head, words);
    }
  }

  #lineStart(): Completion[] {
    const instruments = this.#vocabulary.instruments().map((name) => ({ label: name, detail: instrumentDetail(this.#vocabulary.manifest(name)) }));
    return [...instruments, ...STATEMENT_WORDS.map((label) => ({ label, detail: statementDetail(label) ?? "" }))];
  }

  #tracks(source: string): Completion[] {
    return this.#vocabulary.names(source).tracks.map((track) => ({ label: track.name, detail: track.instrument }));
  }

  #sections(source: string): Completion[] {
    return this.#vocabulary.names(source).sections.map((section) => ({ label: section.name, detail: say.section }));
  }

  /** "name: instrument pattern | modifier value | …" */
  #trackLine(source: string, head: string, words: readonly string[]): Completion[] {
    const named = words[0]?.endsWith(":") === true;
    if (named && words.length === 1) return this.#lineStart().filter((option) => this.#vocabulary.manifest(option.label) !== undefined);
    const instrument = (named ? words[1] : words[0]) ?? "";
    if (this.#vocabulary.manifest(instrument) === undefined) return [];
    const bar = head.lastIndexOf("|");
    if (bar === -1) return this.#patternWords(source, instrument);
    const segment = head.slice(bar + 1).trim().split(/\s+/).filter((entry) => entry !== "");
    if (segment.length === 0) {
      return this.#vocabulary.parametersOf(instrument).map((parameter) => ({
        label: parameter.name,
        detail: parameterDetail(parameter),
        insert: parameterWithValue(parameter),
      }));
    }
    return segment.length === 1 ? this.#valuesOf(instrument, segment[0] ?? "") : [];
  }

  #patternWords(source: string, instrument: string): Completion[] {
    const kind = this.#vocabulary.manifest(instrument)?.kind;
    if (kind === "drum") return DRUM_PATTERNS.map((label) => ({ label, detail: say.hits }));
    const key = keyOf(source);
    return kind === "chord" ? [...chordsOf(key), { label: ".", detail: say.rest }] : notesOf(key);
  }

  #valuesOf(instrument: string, name: string): Completion[] {
    const parameter = this.#vocabulary.parameter(instrument, name);
    if (parameter === undefined || parameter.kind === "flag") return [];
    if (parameter.kind === "choice") return parameter.choices.map((label) => ({ label, detail: parameter.name }));
    const detail = parameterDetail(parameter);
    const values = [{ label: parameter.example, detail }];
    if (!parameter.allowsSignal) return values;
    return [...values, ...SIGNAL_SHAPES.map((shape) => ({ label: signalExample(parameter, shape), detail: say.signalOver(shape) }))];
  }

  /** Help for the word under the cursor: a parameter, an instrument, a signal or a statement. */
  hover(source: string, offset: number): HoverHelp | null {
    const { start, end } = lineBounds(source, offset);
    const line = source.slice(start, end);
    const comment = line.indexOf("//");
    for (const match of line.matchAll(WORD_AT)) {
      const from = start + match.index;
      const to = from + match[0].length;
      if (offset < from || offset > to || (comment !== -1 && match.index >= comment)) continue;
      const lines = this.#helpFor(line, match[0].replace(/\(.*$/, ""), match.index);
      return lines === null ? null : { from, to, lines };
    }
    return null;
  }

  #helpFor(line: string, word: string, at: number): readonly string[] | null {
    const manifest = this.#vocabulary.manifest(word);
    const words = line.trim().split(/\s+/);
    // A word inside the song's name ("bass night") is not the instrument it spells.
    if (words[0] === "title" && at > line.indexOf("title")) return null;
    const instrument = (words[0]?.endsWith(":") === true ? words[1] : words[0]) ?? "";
    const bar = line.lastIndexOf("|", at);
    if (bar !== -1 && /^\|\s*$/.test(line.slice(bar, at))) {
      const parameter = this.#vocabulary.parameter(instrument, word);
      if (parameter !== undefined) {
        const owner = parameter.kind === "number" ? parameter.instrument : null;
        const curve = parameter.kind === "number" && parameter.curve !== null ? say.curve(parameter.curve) : null;
        return [say.hoverParameter(parameter.name, owner), curve === null ? parameterDetail(parameter) : `${parameterDetail(parameter)} · ${curve}`];
      }
    }
    if (SIGNAL_SHAPES.includes(word)) return [say.hoverSignalTitle(word), say.hoverSignalBody(word)];
    // A sound is written before the first "|", right after the instrument.
    const sound = bar === -1 ? this.#vocabulary.manifest(instrument)?.presets.find((preset) => preset.name === word) : undefined;
    if (sound !== undefined && word !== instrument) return [say.hoverPresetTitle(sound.name, instrument), this.#describer.sound(instrument, sound.name, sound.description)];
    if (manifest !== undefined) {
      return [
        say.hoverInstrumentTitle(manifest.name),
        this.#describer.instrument(manifest.name, manifest.description),
        say.hoverInstrumentKind(manifest.group, manifest.kind),
        say.hoverInstrumentParameters(manifest.parameters.map((parameter) => parameter.name)),
      ];
    }
    const statement = statementDetail(word);
    return statement !== undefined && line.trimStart().startsWith(word) ? [say.hoverStatementTitle(word), statement] : null;
  }
}
