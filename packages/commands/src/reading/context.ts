// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Program } from "@untzel/core";
import { printNumber, suggest, type AnalyzeResult, type DeclaredNames, type EditFailure, type EditResult } from "@untzel/language";
import { commandNamed } from "./catalog";
import { error, type CommandOutcome } from "../proposal/outcome";
import { propose, type ProposeOptions } from "../proposal/propose";
import { strings } from "../copy/copy";
import type { Vocabulary } from "./vocabulary";
import { readNumber, replaceWord, type Word } from "./words";

/** A checked argument, or the outcome that explains why it is not usable. */
export type Checked<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly outcome: CommandOutcome };

export function accept<T>(value: T): Checked<T> {
  return { ok: true, value };
}

export function refuse<T>(message: string, suggestion: string | null = null): Checked<T> {
  return { ok: false, outcome: error(message, suggestion) };
}

/** One command line being run against the current text. */
export class CommandContext {
  readonly line: string;
  readonly command: string;
  readonly args: readonly Word[];
  readonly source: string;
  readonly vocabulary: Vocabulary;
  readonly analyze: (source: string) => AnalyzeResult;
  #names: DeclaredNames | null = null;
  #analysis: AnalyzeResult | null = null;

  constructor(options: {
    line: string;
    command: string;
    args: readonly Word[];
    source: string;
    vocabulary: Vocabulary;
    analyze: (source: string) => AnalyzeResult;
  }) {
    this.line = options.line;
    this.command = options.command;
    this.args = options.args;
    this.source = options.source;
    this.vocabulary = options.vocabulary;
    this.analyze = options.analyze;
  }

  get names(): DeclaredNames {
    this.#names ??= this.vocabulary.names(this.source);
    return this.#names;
  }

  /** The program of the current text; null while it has errors. */
  get program(): Program | null {
    this.#analysis ??= this.analyze(this.source);
    return this.#analysis.ok ? this.#analysis.program : null;
  }

  /** The command's own example, for "needs" messages and suggestions. */
  get example(): string {
    return commandNamed(this.command)?.example ?? this.command;
  }

  get usage(): string {
    return commandNamed(this.command)?.usage ?? this.command;
  }

  /** The line with one argument replaced. */
  suggestLine(word: Word, replacement: string): string {
    return replaceWord(this.line, word, replacement);
  }

  argument(index: number, need: string): Checked<Word> {
    const word = this.args[index];
    return word === undefined ? refuse(strings.needs(need, this.example), this.example) : accept(word);
  }

  noMoreThan(count: number): Checked<null> {
    return this.args.length > count ? refuse(strings.tooMany(this.usage)) : accept(null);
  }

  track(index: number): Checked<string> {
    const word = this.argument(index, strings.needsTrack(this.command));
    if (!word.ok) return word;
    const names = this.names.tracks.map((track) => track.name);
    if (names.includes(word.value.text)) return accept(word.value.text);
    const near = suggest(word.value.text, names);
    return refuse(strings.unknownTrack(word.value.text), near === null ? null : this.suggestLine(word.value, near));
  }

  section(word: Word): Checked<string> {
    const names = this.names.sections.map((section) => section.name);
    if (names.includes(word.text)) return accept(word.text);
    const near = suggest(word.text, names);
    return refuse(strings.unknownSection(word.text), near === null ? null : this.suggestLine(word, near));
  }

  /** A whole or decimal number in [min, max]; out of range suggests the nearest limit. */
  number(index: number, what: string, need: string, bounds: { min: number; max: number; integer: boolean }): Checked<number> {
    const word = this.argument(index, need);
    if (!word.ok) return word;
    const value = readNumber(word.value.text);
    if (value === null) return refuse(strings.notANumber(word.value.text), this.example);
    const fits = value >= bounds.min && value <= bounds.max && (!bounds.integer || Number.isInteger(value));
    if (fits) return accept(value);
    const clamped = Math.min(Math.max(bounds.integer ? Math.round(value) : value, bounds.min), bounds.max);
    const message = bounds.integer ? strings.wholeBetween(what, bounds.min, bounds.max) : strings.between(what, bounds.min, bounds.max);
    return refuse(message, this.suggestLine(word.value, printNumber(clamped) ?? String(clamped)));
  }

  /** Every text-changing command ends here. */
  propose(edit: EditResult, options: ProposeOptions): CommandOutcome {
    if (!edit.ok) return error(failureMessage(edit.reason));
    return propose(this.source, edit.source, options, this.analyze);
  }
}

function failureMessage(reason: EditFailure): string {
  switch (reason) {
    case "SECTION_WOULD_BE_EMPTY":
      return strings.sectionWouldBeEmpty;
    case "NAME_TAKEN":
      return strings.nameTakenShort;
    default:
      return strings.editRefused;
  }
}
