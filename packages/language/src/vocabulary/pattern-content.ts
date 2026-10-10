// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentKind, PatternAtom, PatternElement, PatternSpec } from "@untzel/core";

// What a pattern plays, and which instruments can play it. One owner for the rule the
// reader checks (PATTERN_KIND_MISMATCH), Change sound filters by and setInstrument
// enforces, so the list and the write never disagree.

export type PatternContent = "hits" | "notes" | "chords";

/** A chord instrument also plays single notes. */
const PLAYS: Readonly<Record<InstrumentKind, readonly PatternContent[]>> = {
  drum: ["hits"],
  pitched: ["notes"],
  chord: ["chords", "notes"],
};

/** What `kind` plays, for messages: "hits", "notes", "chords and notes". */
export function playedBy(kind: InstrumentKind): readonly PatternContent[] {
  return PLAYS[kind];
}

/**
 * What one atom plays. Null for rests, sustains, a hits token without x or X (a pitched
 * pattern writes its rests as "."), and groups, whose elements are read one by one.
 */
export function atomContent(atom: PatternAtom): PatternContent | null {
  switch (atom.kind) {
    case "hits":
      return atom.steps.some((step) => step === "hit" || step === "accent") ? "hits" : null;
    case "note":
      return "notes";
    case "chord":
    case "stack":
      return "chords";
    default:
      return null;
  }
}

function elementContents(element: PatternElement): readonly PatternContent[] {
  if (element.kind === "group") return element.elements.flatMap(elementContents);
  const content = atomContent(element);
  return content === null ? [] : [content];
}

/** Everything the pattern plays, each once, in the order it first appears. */
export function patternContent(spec: PatternSpec): readonly PatternContent[] {
  const contents = spec.bars.flatMap((bar) => bar.elements.flatMap(elementContents));
  return [...new Set(contents)];
}

/** `kind` plays every content of the pattern (an empty pattern fits every kind). */
export function canPlay(kind: InstrumentKind, content: readonly PatternContent[]): boolean {
  return content.every((entry) => PLAYS[kind].includes(entry));
}
