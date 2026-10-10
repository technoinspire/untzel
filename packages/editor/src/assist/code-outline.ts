// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { SyntaxNode, Tree } from "@lezer/common";
import { trackColorIndex } from "@untzel/core";
import { readNames } from "@untzel/language";

// What the code panel draws beyond token colors, read from the grammar's tree as plain
// data. Pure: no DOM, no editor state, so
// it is unit tested on its own; the decorations only turn it into classes.

export type StepKind = "hit" | "hit-accent" | "rest" | "sustain";

export interface Span {
  readonly from: number;
  readonly to: number;
}

export interface TrackLine {
  /** 1-based. */
  readonly line: number;
  readonly name: string;
  readonly color: number;
  /** The track's name as written, or its instrument when it has no name. */
  readonly label: Span;
  /** Column of the pattern (or of the first "|"); 0 when there is neither. */
  readonly hang: number;
}

export interface CodeOutline {
  readonly tracks: readonly TrackLine[];
  /** Track names listed by sections, in their track's color. */
  readonly members: readonly (Span & { readonly color: number })[];
  /** The first name of a section line. */
  readonly sectionNames: readonly Span[];
  readonly steps: readonly (Span & { readonly kind: StepKind })[];
  /** "| cutoff 900" and "intro 8,": never broken across visual lines. */
  readonly groups: readonly Span[];
  /** 1-based lines of each run of consecutive section lines. */
  readonly sectionBlocks: readonly (readonly number[])[];
}

const STEP_KINDS: Readonly<Record<string, StepKind>> = { x: "hit", X: "hit-accent", ".": "rest", "~": "sustain" };

/** Each run of one step character in a hits word: "x..." is "x", then "...". */
export function stepRuns(source: string, from: number, to: number): (Span & { kind: StepKind })[] {
  const runs: (Span & { kind: StepKind })[] = [];
  let start = from;
  for (let at = from + 1; at <= to; at += 1) {
    if (at < to && source[at] === source[start]) continue;
    const kind = STEP_KINDS[source[start] ?? ""];
    if (kind !== undefined) runs.push({ from: start, to: at, kind });
    start = at;
  }
  return runs;
}

/** From the "|" before a modifier (blanks between them included) to its end. */
function barGroup(source: string, node: SyntaxNode): Span {
  let at = node.from - 1;
  while (at > 0 && (source[at] === " " || source[at] === "\t")) at -= 1;
  return { from: source[at] === "|" ? at : node.from, to: node.to };
}

/** A song part with the "," after it: "intro 8,". */
function partGroup(source: string, part: SyntaxNode): Span {
  let to = part.to;
  while (source[to] === " " || source[to] === "\t") to += 1;
  return { from: part.from, to: source[to] === "," ? to + 1 : part.to };
}

class OutlineReader {
  readonly #source: string;
  readonly #lineStarts: number[] = [0];
  readonly #names: ReadonlyMap<number, string>;
  readonly #trackNames: ReadonlySet<string>;
  readonly tracks: TrackLine[] = [];
  readonly members: (Span & { color: number })[] = [];
  readonly sectionNames: Span[] = [];
  readonly steps: (Span & { kind: StepKind })[] = [];
  readonly groups: Span[] = [];
  readonly sectionLines: number[] = [];

  constructor(source: string) {
    this.#source = source;
    for (let at = source.indexOf("\n"); at !== -1; at = source.indexOf("\n", at + 1)) this.#lineStarts.push(at + 1);
    // The names the analysis gives, automatic ones included, even while the text has errors.
    const tracks = readNames(source).tracks;
    this.#names = new Map(tracks.map((track) => [track.line, track.name]));
    this.#trackNames = new Set(tracks.map((track) => track.name));
  }

  /** 1-based line of an offset. */
  lineOf(offset: number): number {
    let low = 0;
    let high = this.#lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if ((this.#lineStarts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  }

  statement(node: SyntaxNode): void {
    if (node.name === "Track") this.#track(node);
    if (node.name === "SectionDecl") this.#section(node);
    if (node.name === "SongDecl") for (const part of node.getChildren("Part")) this.groups.push(partGroup(this.#source, part));
    for (const modifier of node.getChildren("Modifier")) this.groups.push(barGroup(this.#source, modifier));
    const loop = node.name === "SongDecl" ? node.getChild("loop") : null;
    if (loop !== null) this.groups.push(barGroup(this.#source, loop));
    node.cursor().iterate((inner) => {
      if (inner.name === "Hits") this.steps.push(...stepRuns(this.#source, inner.from, inner.to));
    });
  }

  #track(node: SyntaxNode): void {
    const line = this.lineOf(node.from);
    const name = this.#names.get(line);
    const label = node.getChild("TrackName") ?? node.getChild("InstrumentName");
    if (name === undefined || label === null) return;
    const anchor = node.getChild("Pattern")?.from ?? node.getChild("Modifier")?.from ?? null;
    const hang = anchor === null ? 0 : anchor - (this.#lineStarts[line - 1] ?? 0);
    this.tracks.push({ line, name, color: trackColorIndex(name), label: { from: label.from, to: label.to }, hang });
  }

  #section(node: SyntaxNode): void {
    this.sectionLines.push(this.lineOf(node.from));
    const [title, ...members] = node.getChildren("Name");
    if (title !== undefined) this.sectionNames.push({ from: title.from, to: title.to });
    for (const member of members) {
      const text = this.#source.slice(member.from, member.to);
      if (this.#trackNames.has(text)) this.members.push({ from: member.from, to: member.to, color: trackColorIndex(text) });
    }
  }
}

function blocks(lines: readonly number[]): number[][] {
  const out: number[][] = [];
  for (const line of lines) {
    const last = out.at(-1);
    if (last !== undefined && last.at(-1) === line - 1) last.push(line);
    else out.push([line]);
  }
  return out;
}

export function readOutline(source: string, tree: Tree): CodeOutline {
  const reader = new OutlineReader(source);
  const cursor = tree.topNode.cursor();
  if (cursor.firstChild()) {
    do {
      const statement = cursor.name === "Line" ? cursor.node.firstChild : null;
      if (statement !== null) reader.statement(statement);
    } while (cursor.nextSibling());
  }
  return {
    tracks: reader.tracks,
    members: reader.members,
    sectionNames: reader.sectionNames,
    steps: reader.steps,
    groups: reader.groups,
    sectionBlocks: blocks(reader.sectionLines),
  };
}
