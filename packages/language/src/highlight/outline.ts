// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { SyntaxNode, Tree } from "@lezer/common";
import type { SignalShape } from "@untzel/core";

/** A signal shape as written: the transport shapes plus the per-note `env`. */
export type WrittenShape = SignalShape | "env";

/** The period of a signal: a number (`sine(8)`) or a division (`sine(1/8)`). */
export type PeriodSyntax =
  | ({ readonly kind: "number"; readonly number: Token } & Range)
  | ({ readonly kind: "division"; readonly numerator: Token; readonly denominator: Token } & Range);
import type { Range } from "../diagnostics/diagnostics";
import type { LineIndex } from "../read/lines";

// A typed view of the syntax tree, one entry per statement, shared by the analysis and
// by the minimal edits. It only reads the tree: no validation happens here.

/** A piece of source text and where it is. */
export interface Token extends Range {
  readonly text: string;
}

export type ValueSyntax =
  | ({ readonly kind: "number"; readonly number: Token } & Range)
  | ({
      readonly kind: "signal";
      readonly shape: WrittenShape;
      readonly signal: Token;
      readonly period: PeriodSyntax | null;
      readonly range: { readonly low: Token; readonly high: Token } | null;
    } & Range)
  | ({ readonly kind: "division"; readonly numerator: Token; readonly denominator: Token } & Range)
  | ({ readonly kind: "name"; readonly name: Token } & Range);

export interface ModifierSyntax extends Range {
  readonly name: Token;
  readonly value: ValueSyntax | null;
  /** "| name value" with the blanks before the bar: what removing it takes away. */
  readonly removal: Range;
}

interface StatementBase extends Range {
  /** 0-based physical line. */
  readonly line: number;
  /** The first token, where order and duplicate diagnostics point. */
  readonly head: Token;
}

export interface TitleSyntax extends StatementBase {
  readonly kind: "title";
  /** The String token, quotes and escapes included. */
  readonly value: Token;
}
export interface TempoSyntax extends StatementBase {
  readonly kind: "tempo";
  readonly value: Token;
}

export interface KeySyntax extends StatementBase {
  readonly kind: "key";
  readonly tonic: Token;
  readonly scale: Token;
}

export interface SwingSyntax extends StatementBase {
  readonly kind: "swing";
  readonly value: Token;
}

export interface LoopSyntax extends StatementBase {
  readonly kind: "loop";
  readonly value: Token;
}

export interface TrackSyntax extends StatementBase {
  readonly kind: "track";
  readonly name: Token | null;
  readonly instrument: Token;
  /** The named sound after the instrument (`piano bright`), or null. */
  readonly preset: Token | null;
  /** The Pattern node; null for "kick" or "kick | gain 0.5". */
  readonly pattern: SyntaxNode | null;
  readonly modifiers: readonly ModifierSyntax[];
}

export interface SectionSyntax extends StatementBase {
  readonly kind: "section";
  readonly name: Token;
  readonly tracks: readonly Token[];
  readonly modifiers: readonly ModifierSyntax[];
}

export interface PartSyntax extends Range {
  readonly section: Token;
  readonly bars: Token;
}

export interface SongSyntax extends StatementBase {
  readonly kind: "song";
  readonly parts: readonly PartSyntax[];
  readonly loop: boolean;
}

export type StatementSyntax =
  | TitleSyntax
  | TempoSyntax
  | KeySyntax
  | SwingSyntax
  | LoopSyntax
  | TrackSyntax
  | SectionSyntax
  | SongSyntax;

/** Reads tokens of one source. */
class TreeReader {
  readonly #source: string;
  readonly #lines: LineIndex;

  constructor(source: string, lines: LineIndex) {
    this.#source = source;
    this.#lines = lines;
  }

  token(node: SyntaxNode): Token {
    return { text: this.#source.slice(node.from, node.to), from: node.from, to: node.to };
  }

  optionalToken(node: SyntaxNode | null): Token | null {
    return node === null ? null : this.token(node);
  }

  statement(node: SyntaxNode): StatementSyntax | null {
    const head = node.firstChild;
    if (head === null) return null;
    const base = { from: node.from, to: node.to, line: this.#lines.lineOf(node.from), head: this.token(head) };
    switch (node.name) {
      case "TempoStatement":
      case "SwingStatement":
      case "LoopStatement": {
        const value = node.getChild("Number");
        if (value === null) return null;
        if (node.name === "TempoStatement") return { ...base, kind: "tempo", value: this.token(value) };
        if (node.name === "LoopStatement") return { ...base, kind: "loop", value: this.token(value) };
        return { ...base, kind: "swing", value: this.token(value) };
      }
      case "TitleStatement": {
        const value = node.getChild("String");
        return value === null ? null : { ...base, kind: "title", value: this.token(value) };
      }
      case "KeyStatement":
        return this.#key(node, base);
      case "Track":
        return this.#track(node, base);
      case "SectionDecl":
        return this.#section(node, base);
      case "SongDecl":
        return this.#song(node, base);
      default:
        return null;
    }
  }

  #key(node: SyntaxNode, base: StatementBase): KeySyntax | null {
    const tonic = node.getChild("Tonic");
    const scale = node.getChild("Name");
    if (tonic === null || scale === null) return null;
    return { ...base, kind: "key", tonic: this.token(tonic), scale: this.token(scale) };
  }

  #track(node: SyntaxNode, base: StatementBase): TrackSyntax | null {
    const instrument = node.getChild("InstrumentName");
    if (instrument === null) return null;
    return {
      ...base,
      kind: "track",
      name: this.optionalToken(node.getChild("TrackName")),
      instrument: this.token(instrument),
      preset: this.optionalToken(node.getChild("Preset")),
      pattern: node.getChild("Pattern"),
      modifiers: this.#modifiers(node),
    };
  }

  #section(node: SyntaxNode, base: StatementBase): SectionSyntax | null {
    const [name, ...tracks] = node.getChildren("Name").map((child) => this.token(child));
    if (name === undefined) return null;
    return { ...base, kind: "section", name, tracks, modifiers: this.#modifiers(node) };
  }

  #song(node: SyntaxNode, base: StatementBase): SongSyntax {
    const parts = node.getChildren("Part").flatMap((part): PartSyntax[] => {
      const section = part.getChild("Name");
      const bars = part.getChild("Number");
      if (section === null || bars === null) return [];
      return [{ from: part.from, to: part.to, section: this.token(section), bars: this.token(bars) }];
    });
    return { ...base, kind: "song", parts, loop: node.getChild("loop") !== null };
  }

  #modifiers(node: SyntaxNode): ModifierSyntax[] {
    return node.getChildren("Modifier").flatMap((modifier): ModifierSyntax[] => {
      const name = modifier.getChild("ModifierName");
      if (name === null) return [];
      const value = modifier.getChild("Value");
      return [
        {
          from: modifier.from,
          to: modifier.to,
          name: this.token(name),
          value: value === null ? null : this.#value(value),
          removal: { from: this.#barStart(modifier.from), to: modifier.to },
        },
      ];
    });
  }

  /** Start of the blanks before the "|" that introduces a modifier at `from`. */
  #barStart(from: number): number {
    const blankStart = (offset: number): number => {
      let at = offset;
      while (at > 0 && (this.#source[at - 1] === " " || this.#source[at - 1] === "\t")) at -= 1;
      return at;
    };
    const bar = blankStart(from) - 1;
    return this.#source[bar] === "|" ? blankStart(bar) : from;
  }

  #value(node: SyntaxNode): ValueSyntax | null {
    const range = { from: node.from, to: node.to };
    const first = node.firstChild;
    if (first === null) return null;
    switch (first.name) {
      case "Number":
        return { ...range, kind: "number", number: this.token(first) };
      case "Name":
        return { ...range, kind: "name", name: this.token(first) };
      case "Division": {
        const [numerator, denominator] = first.getChildren("Number");
        if (numerator === undefined || denominator === undefined) return null;
        return { ...range, kind: "division", numerator: this.token(numerator), denominator: this.token(denominator) };
      }
      case "Signal":
        return this.#signal(first, node.getChild("Range"), range);
      default:
        return null;
    }
  }

  #period(signal: SyntaxNode): PeriodSyntax | null {
    const number = signal.getChild("Number");
    if (number !== null) return { kind: "number", number: this.token(number), from: number.from, to: number.to };
    const division = signal.getChild("Division");
    const [numerator, denominator] = division?.getChildren("Number") ?? [];
    if (division === null || division === undefined || numerator === undefined || denominator === undefined) return null;
    return {
      kind: "division",
      numerator: this.token(numerator),
      denominator: this.token(denominator),
      from: division.from,
      to: division.to,
    };
  }

  #signal(signal: SyntaxNode, rangeNode: SyntaxNode | null, range: Range): ValueSyntax | null {
    const shape = signal.getChild("SignalShape");
    if (shape === null) return null;
    const [low, high] = rangeNode?.getChildren("Number") ?? [];
    return {
      ...range,
      kind: "signal",
      shape: this.token(shape).text as WrittenShape,
      signal: this.token(signal),
      period: this.#period(signal),
      range: low === undefined || high === undefined ? null : { low: this.token(low), high: this.token(high) },
    };
  }
}

/** Every statement of the tree, in text order. */
export function readOutline(tree: Tree, source: string, lines: LineIndex): readonly StatementSyntax[] {
  const reader = new TreeReader(source, lines);
  const statements: StatementSyntax[] = [];
  for (const line of tree.topNode.getChildren("Line")) {
    for (let child = line.firstChild; child !== null; child = child.nextSibling) {
      const statement = reader.statement(child);
      if (statement !== null) statements.push(statement);
    }
  }
  return statements;
}
