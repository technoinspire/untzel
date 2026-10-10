// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { SyntaxNode } from "@lezer/common";
import {
  chordNameToMidis,
  noteNameToMidi,
  type HitStep,
  type InstrumentManifest,
  type PatternAtom,
  type PatternBar,
  type PatternElement,
  type PatternSpec,
} from "@untzel/core";
import type { DiagnosticList } from "../diagnostics/diagnostics";
import { clampFix } from "../diagnostics/fixes";
import {
  DEFAULT_PROBABILITY,
  MAX_BARS_PER_PATTERN,
  MAX_GROUP_DEPTH,
  MAX_REPEAT,
  MAX_STEPS_PER_BAR,
  MIN_REPEAT,
} from "../limits";
import { messages } from "../copy/messages";
import { noteFix } from "../vocabulary/note-spelling";
import type { Token } from "../highlight/outline";
import { atomContent, canPlay, playedBy, type PatternContent } from "../vocabulary/pattern-content";
import { numberOf } from "./read-values";

export interface PatternReading {
  readonly spec: PatternSpec;
  /** Some element has "?". */
  readonly usesProbability: boolean;
}

const MIN_STACK = 2;
const MAX_STACK = 8;

const HIT_STEPS: Readonly<Record<string, HitStep>> = { ".": "rest", x: "hit", X: "accent", "~": "sustain" };
const PROBABILITY_BOUNDS = { min: 0, max: 1, integer: false };
const REPEAT_BOUNDS = { min: MIN_REPEAT, max: MAX_REPEAT, integer: true };

/** Steps an element takes in its bar: one per hits character, one otherwise. */
export function elementWeight(element: PatternElement): number {
  return element.kind === "hits" ? element.steps.length : 1;
}

class PatternReader {
  readonly #source: string;
  readonly #manifest: InstrumentManifest | null;
  readonly #diagnostics: DiagnosticList;
  #usesProbability = false;
  #mismatchReported = false;

  constructor(source: string, manifest: InstrumentManifest | null, diagnostics: DiagnosticList) {
    this.#source = source;
    this.#manifest = manifest;
    this.#diagnostics = diagnostics;
  }

  get usesProbability(): boolean {
    return this.#usesProbability;
  }

  #token(node: SyntaxNode): Token {
    return { text: this.#source.slice(node.from, node.to), from: node.from, to: node.to };
  }

  /** INVALID_NOTE, with the nearest octave the MIDI range has as its fix. */
  #invalidNote(node: SyntaxNode): void {
    const token = this.#token(node);
    const { suggestion, fix } = noteFix(token);
    this.#diagnostics.error("INVALID_NOTE", messages.invalidNote(token.text, suggestion), token, fix);
  }

  pattern(node: SyntaxNode): PatternSpec {
    const bars = node.getChildren("Bar");
    if (bars.length > MAX_BARS_PER_PATTERN) {
      this.#diagnostics.error("TOO_MANY_BARS", messages.tooManyBars(MAX_BARS_PER_PATTERN), node);
    }
    return { bars: bars.map((bar) => this.#bar(bar)) };
  }

  #bar(node: SyntaxNode): PatternBar {
    const elements = this.#elements(node, 0);
    const steps = elements.reduce((total, element) => total + elementWeight(element), 0);
    if (steps > MAX_STEPS_PER_BAR) {
      this.#diagnostics.error("TOO_MANY_STEPS", messages.tooManySteps(MAX_STEPS_PER_BAR), node);
    }
    return { elements, source: { from: node.from, to: node.to } };
  }

  #elements(node: SyntaxNode, depth: number): PatternElement[] {
    return node.getChildren("Element").flatMap((element) => {
      const read = this.#element(element, depth);
      return read === null ? [] : [read];
    });
  }

  #element(node: SyntaxNode, depth: number): PatternElement | null {
    const atomNode = node.getChild("Atom")?.firstChild ?? null;
    if (atomNode === null) return null;
    const atom = this.#atom(atomNode, depth);
    const accent = this.#accent(node.getChild("Accent"), atomNode, atom);
    const probability = this.#probability(node.getChild("Probability"));
    const repeat = this.#repeat(node.getChild("Repeat"));
    if (atom === null) return null;
    return { ...atom, accent, probability, repeat, source: { from: atomNode.from, to: atomNode.to } };
  }

  /** After hits the last step must be x or X; after "~" there is nothing to accent. */
  #accent(node: SyntaxNode | null, atomNode: SyntaxNode, atom: PatternAtom | null): boolean {
    if (node === null) return false;
    const last = this.#source.slice(atomNode.to - 1, atomNode.to);
    const valid = atom !== null && atom.kind !== "sustain" && (atom.kind !== "hits" || last === "x" || last === "X");
    if (!valid) this.#diagnostics.error("OUT_OF_RANGE", messages.accentNeedsHit(), node);
    return valid;
  }

  /** The atom, checked against what the instrument plays (pattern-content.ts owns the rule). */
  #atom(node: SyntaxNode, depth: number): PatternAtom | null {
    const atom = this.#readAtom(node, depth);
    const content = atom === null ? null : atomContent(atom);
    if (content !== null) this.#checkKind(content, node);
    return atom;
  }

  #readAtom(node: SyntaxNode, depth: number): PatternAtom | null {
    const text = this.#source.slice(node.from, node.to);
    switch (node.name) {
      case "Hits":
        return { kind: "hits", steps: [...text].map((char) => HIT_STEPS[char] ?? "rest") };
      case "Note": {
        const midi = noteNameToMidi(text);
        if (midi !== null) return { kind: "note", midi };
        this.#invalidNote(node);
        return null;
      }
      case "Stack":
        return this.#stack(node);
      case "Chord": {
        const midis = chordNameToMidis(text);
        return midis === null ? null : { kind: "chord", midis };
      }
      case "Sustain":
        return { kind: "sustain" };
      case "Group":
        return this.#group(node, depth + 1);
      default:
        return null;
    }
  }

  /** "c3+eb3+g3": notes as written, 2 to 8; only chord instruments play it. */
  #stack(node: SyntaxNode): PatternAtom | null {
    const notes = node.getChildren("Note");
    if (notes.length < MIN_STACK || notes.length > MAX_STACK) {
      this.#diagnostics.error("OUT_OF_RANGE", messages.stackSize(MIN_STACK, MAX_STACK), node);
      return null;
    }
    const midis: number[] = [];
    for (const note of notes) {
      const text = this.#source.slice(note.from, note.to);
      const midi = noteNameToMidi(text);
      if (midi === null) {
        this.#invalidNote(note);
        return null;
      }
      midis.push(midi);
    }
    return { kind: "stack", midis };
  }

  #group(node: SyntaxNode, depth: number): PatternAtom | null {
    if (depth > MAX_GROUP_DEPTH) {
      this.#diagnostics.error("OUT_OF_RANGE", messages.groupDepth(MAX_GROUP_DEPTH), node);
      return null;
    }
    const elements = this.#elements(node, depth);
    return elements.length === 0 ? null : { kind: "group", elements };
  }

  #probability(node: SyntaxNode | null): number | null {
    if (node === null) return null;
    this.#usesProbability = true;
    const number = node.getChild("Number");
    if (number === null) return DEFAULT_PROBABILITY;
    const token = this.#token(number);
    const value = numberOf(token);
    if (value >= 0 && value <= 1) return value;
    this.#diagnostics.error("OUT_OF_RANGE", messages.probability(), token, clampFix(token, value, PROBABILITY_BOUNDS));
    return DEFAULT_PROBABILITY;
  }

  #repeat(node: SyntaxNode | null): number {
    const number = node?.getChild("Number") ?? null;
    if (number === null) return 1;
    const token = this.#token(number);
    const value = numberOf(token);
    if (Number.isInteger(value) && value >= MIN_REPEAT && value <= MAX_REPEAT) return value;
    this.#diagnostics.error("OUT_OF_RANGE", messages.repeat(MIN_REPEAT, MAX_REPEAT), token, clampFix(token, value, REPEAT_BOUNDS));
    return 1;
  }

  /** One PATTERN_KIND_MISMATCH per track, at the first atom the instrument cannot play. */
  #checkKind(content: PatternContent, node: SyntaxNode): void {
    const manifest = this.#manifest;
    if (manifest === null || this.#mismatchReported) return;
    if (canPlay(manifest.kind, [content])) return;
    this.#mismatchReported = true;
    const message = messages.kindMismatch(manifest.name, playedBy(manifest.kind), content);
    this.#diagnostics.error("PATTERN_KIND_MISMATCH", message, node);
  }
}

/** Pattern node -> PatternSpec, with every limit of the pattern checked. */
export function readPattern(
  node: SyntaxNode,
  source: string,
  manifest: InstrumentManifest | null,
  diagnostics: DiagnosticList,
): PatternReading {
  const reader = new PatternReader(source, manifest, diagnostics);
  const spec = reader.pattern(node);
  return { spec, usesProbability: reader.usesProbability };
}
