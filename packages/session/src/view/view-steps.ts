// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { PatternElement, SourceRange, Track } from "@untzel/core";

// A track's pattern as the view shows it: one step per leaf, and where it is written.

/** One leaf of a bar, in text order. A hits token gives one cell per character. */
export type StepView = (
  | { readonly kind: "rest" | "hit" | "accent" | "sustain" }
  | { readonly kind: "note"; readonly midi: number }
  | { readonly kind: "chord"; readonly midis: readonly number[] }
  /** "[ … ]": not editable as one step. */
  | { readonly kind: "group" }
) & {
  /** Pass to toggleStep. One character for a hits step. */
  readonly source: SourceRange;
  readonly probability: number | null;
  readonly repeat: number;
};

export function stepsOf(element: PatternElement): StepView[] {
  const shared = { probability: element.probability, repeat: element.repeat };
  switch (element.kind) {
    case "hits":
      return element.steps.map((step, index) => ({
        kind: step === "hit" ? "hit" : step === "accent" ? "accent" : step,
        source: { from: element.source.from + index, to: element.source.from + index + 1 },
        ...shared,
      }));
    case "note":
      return [{ kind: "note", midi: element.midi, source: element.source, ...shared }];
    case "chord":
    case "stack":
      return [{ kind: "chord", midis: element.midis, source: element.source, ...shared }];
    case "sustain":
      return [{ kind: "sustain", source: element.source, ...shared }];
    case "group":
      return [{ kind: "group", source: element.source, ...shared }];
  }
}

/** From the first bar to the last: what a pattern chip compares with. */
export function patternRange(track: Track): SourceRange | null {
  const first = track.pattern.bars[0];
  const last = track.pattern.bars.at(-1);
  return first === undefined || last === undefined ? null : { from: first.source.from, to: last.source.to };
}
