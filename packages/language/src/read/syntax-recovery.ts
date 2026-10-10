// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { SIGNAL_SHAPES } from "@untzel/core";
import type { DiagnosticCode, DiagnosticFix, DiagnosticMessage, Range } from "../diagnostics/diagnostics";
import { replaceFix, suggestionFix } from "../diagnostics/fixes";
import { messages } from "../copy/messages";
import { respelledNote } from "../vocabulary/note-spelling";
import type { Token } from "../highlight/outline";
import { ENVELOPE_SHAPE } from "./read-values";
import { closest } from "../diagnostics/suggest";

// A line that does not parse, read once more for what was probably meant:
// a statement keyword with a typo, a note spelled in
// capitals or with its octave apart, a signal shape with a typo. Each reading anchors on
// the word that caused the error, not on the token the parser stopped at.

/** The statements a line can start with, in the order of the grammar's Line rule. */
export const STATEMENT_KEYWORDS: readonly string[] = ["title", "tempo", "key", "swing", "section", "song", "loop"];
const SIGNAL_WORDS: readonly string[] = [...SIGNAL_SHAPES, ENVELOPE_SHAPE];

const WORD_CHAR = /[A-Za-z0-9#_-]/;
const FIRST_WORD = /^[ \t]*([a-z][a-z0-9_-]*)[ \t]*(:?)/;
const TONIC = /^[A-Ga-g][b#]?$/;
const DIGIT = /^\d$/;
/** A word that starts a pattern: a group, a hold, a chord, hits or a note (the grammar's tokens). */
const PATTERN_WORD = /^(?:[[~A-G]|(?:[xX.][xX.~]*|[a-g][b#]?\d)(?![a-z0-9_-]))/;

/** One physical line with a syntax error, and what the text around it declares. */
export interface ErrorLine {
  readonly source: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  /** Where the parser's first error node on the line starts. */
  readonly errorFrom: number;
  /** Instrument names: a line starting with one is a track, not a misspelled statement. */
  readonly instruments: ReadonlySet<string>;
}

/** The diagnostic a reading gives instead of the generic `Unexpected`. */
export interface Recovery {
  readonly code: DiagnosticCode;
  readonly message: DiagnosticMessage;
  readonly range: Range;
  readonly fix: DiagnosticFix | null;
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}

function tokenOf(source: string, from: number, to: number): Token {
  return { text: source.slice(from, to), from, to };
}

/** The whole word the offset is in, within [lineStart, lineEnd); null outside a word. */
export function wordAround(source: string, offset: number, lineStart: number, lineEnd: number): Token | null {
  if (!isWordChar(source[offset])) return null;
  let from = offset;
  while (from > lineStart && isWordChar(source[from - 1])) from -= 1;
  let to = offset;
  while (to < lineEnd && isWordChar(source[to])) to += 1;
  return tokenOf(source, from, to);
}

/** The word right before `offset`, past blanks; null when none on the line. */
function wordBefore(source: string, offset: number, lineStart: number): Token | null {
  let to = offset;
  while (to > lineStart && (source[to - 1] === " " || source[to - 1] === "\t")) to -= 1;
  if (!isWordChar(source[to - 1])) return null;
  return wordAround(source, to - 1, lineStart, to);
}

/** The word right after `offset`, past blanks; null when none on the line. */
function wordAfter(source: string, offset: number, lineEnd: number): Token | null {
  let from = offset;
  while (from < lineEnd && (source[from] === " " || source[from] === "\t")) from += 1;
  return wordAround(source, from, from, lineEnd);
}

/** The word the generic `Unexpected` names: the culprit's own, not the token after it. */
export function culpritWord(line: ErrorLine): Token | null {
  return wordAround(line.source, line.errorFrom, line.lineStart, line.lineEnd);
}

/** The word the error starts in, or the one it starts right before (a zero-width error). */
function culprit(line: ErrorLine): Token | null {
  return culpritWord(line) ?? wordAfter(line.source, line.errorFrom, line.lineEnd);
}

/**
 * Steps after the first word make the line a track (`keys x... ]`): its error is elsewhere.
 * Only the words before the first "|" count, never a comment nor the song's name.
 */
function hasSteps(rest: string): boolean {
  const steps = rest.split("//")[0]?.split("|")[0] ?? "";
  if (steps.trimStart().startsWith('"')) return false;
  return steps.split(/[ \t]+/).some((word) => PATTERN_WORD.test(word));
}

/** `temp 132` -> `Unknown statement "temp". Did you mean "tempo"?` */
function misspelledStatement(line: ErrorLine): Recovery | null {
  const { source, lineStart, lineEnd } = line;
  const match = FIRST_WORD.exec(source.slice(lineStart, lineEnd));
  const word = match?.[1];
  if (match === null || word === undefined || match[2] === ":") return null;
  if (STATEMENT_KEYWORDS.includes(word) || line.instruments.has(word)) return null;
  if (hasSteps(source.slice(lineStart + match[0].length, lineEnd))) return null;
  const suggestion = closest(word, STATEMENT_KEYWORDS);
  if (suggestion === null) return null;
  const from = lineStart + match[0].indexOf(word);
  const token = tokenOf(source, from, from + word.length);
  return { code: "SYNTAX_ERROR", message: messages.unknownStatement(word, suggestion.text), range: token, fix: suggestionFix(token, suggestion) };
}

/** `sin(8)` -> `Unknown signal "sin". Did you mean "sine"?` */
function misspelledSignal(line: ErrorLine): Recovery | null {
  const { source, errorFrom, lineStart } = line;
  if (source[errorFrom] !== "(" || !isWordChar(source[errorFrom - 1])) return null;
  const word = wordAround(source, errorFrom - 1, lineStart, errorFrom);
  if (word === null || SIGNAL_WORDS.includes(word.text)) return null;
  const suggestion = closest(word.text, SIGNAL_WORDS);
  return { code: "SYNTAX_ERROR", message: messages.unknownSignal(word.text, suggestion?.text ?? null), range: word, fix: suggestionFix(word, suggestion) };
}

/** The note a capital letter or a blank broke: `C2`, `Eb2`, `c 2`, `C 2`. */
function brokenNote(line: ErrorLine, word: Token): Token | null {
  const { source, lineStart, lineEnd } = line;
  if (respelledNote(word.text) !== null) return word;
  if (TONIC.test(word.text)) {
    const octave = wordAfter(source, word.to, lineEnd);
    return octave !== null && DIGIT.test(octave.text) ? tokenOf(source, word.from, octave.to) : null;
  }
  if (DIGIT.test(word.text)) {
    const tonic = wordBefore(source, word.from, lineStart);
    return tonic !== null && TONIC.test(tonic.text) ? tokenOf(source, tonic.from, word.to) : null;
  }
  return null;
}

/** `C2` -> `"C2" is not a note. Did you mean "c2"?`, anchored on the whole note. */
function misspelledNote(line: ErrorLine): Recovery | null {
  const word = culprit(line);
  const note = word === null ? null : brokenNote(line, word);
  const spelled = note === null ? null : respelledNote(note.text);
  if (note === null || spelled === null) return null;
  return { code: "INVALID_NOTE", message: messages.invalidNote(note.text, spelled), range: note, fix: replaceFix(note, spelled) };
}

/** The first reading that explains the line; null leaves the generic `Unexpected`. */
export function recoverLine(line: ErrorLine): Recovery | null {
  return misspelledStatement(line) ?? misspelledSignal(line) ?? misspelledNote(line);
}
