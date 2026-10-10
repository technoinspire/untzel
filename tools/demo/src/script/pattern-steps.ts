// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { midiToNoteName, type PatternBar, type PatternElement } from "@untzel/core";
import { STEP_COUNTS } from "@untzel/session";
import type { CodeReason, DemoAction } from "../actions";

// A pattern seen as the step grid of the track detail: one cell per step, the same
// widths toggleStep and setStepPitch use (one per hits character, one per other element).
// The grid can tap rests and hits and put single notes; anything else is typed.

export type StepCell =
  | { readonly kind: "rest" }
  | { readonly kind: "hit" }
  | { readonly kind: "note"; readonly midi: number }
  | { readonly kind: "typed"; readonly reason: CodeReason };

const HIT_CELLS = {
  rest: { kind: "rest" },
  hit: { kind: "hit" },
  accent: { kind: "typed", reason: "accent" },
  sustain: { kind: "typed", reason: "sustain" },
} as const satisfies Record<string, StepCell>;

function elementCells(element: PatternElement): StepCell[] {
  if (element.accent) return [{ kind: "typed", reason: "accent" }];
  if (element.probability !== null) return [{ kind: "typed", reason: "probability" }];
  if (element.repeat !== 1) return [{ kind: "typed", reason: "repeat" }];
  switch (element.kind) {
    case "hits":
      return element.steps.map((step) => HIT_CELLS[step]);
    case "note":
      return [{ kind: "note", midi: element.midi }];
    case "chord":
    case "stack":
      return [{ kind: "typed", reason: "chord" }];
    case "sustain":
      return [{ kind: "typed", reason: "sustain" }];
    case "group":
      return [{ kind: "typed", reason: "group" }];
  }
}

export function barCells(bar: PatternBar): StepCell[] {
  return bar.elements.flatMap(elementCells);
}

function cellGap(cell: StepCell, pitched: boolean): CodeReason | null {
  if (cell.kind === "typed") return cell.reason;
  if (cell.kind === "hit" && pitched) return "pitched-hit";
  if (cell.kind === "note" && !pitched) return "drum-note";
  return null;
}

/**
 * Why the grid cannot draw `bars`, or null when it can. `currentCount` is the step count
 * of the new track's default pattern, which setStepCount resamples from.
 */
export function gridGap(bars: readonly (readonly StepCell[])[], pitched: boolean, currentCount: number): CodeReason | null {
  const first = bars[0];
  if (first === undefined) return "no-pattern";
  for (const cell of bars.flat()) {
    const gap = cellGap(cell, pitched);
    if (gap !== null) return gap;
  }
  const count = first.length;
  if (bars.some((bar) => bar.length !== count)) return "mixed-step-counts";
  const reachable = count === currentCount || (STEP_COUNTS.some((allowed) => allowed === count) && (count % currentCount === 0 || currentCount % count === 0));
  return reachable ? null : "step-count";
}

function noteName(midi: number): string {
  const name = midiToNoteName(midi);
  if (name === null) throw new Error(`no note name for midi ${midi}`);
  return name;
}

/** Taps that turn one current cell into the target cell on the grid. */
function stepGestures(track: string, bar: number, step: number, current: StepCell, target: StepCell): DemoAction[] {
  const toggle: DemoAction = { kind: "toggleStep", track, bar, step };
  if (target.kind === "note") {
    if (current.kind === "note" && current.midi === target.midi) return [];
    return [{ kind: "setStepNote", track, bar, step, note: noteName(target.midi) }];
  }
  if (current.kind === target.kind) return [];
  if (target.kind === "rest" || current.kind === "rest") return [toggle];
  // A held or noted step becomes a rest first, then a hit.
  return [toggle, toggle];
}

/** The taps that turn the current cells of a bar into the target cells. */
export function barGestures(track: string, bar: number, current: readonly StepCell[], target: readonly StepCell[]): DemoAction[] {
  if (current.length !== target.length) throw new Error(`bar ${bar} of ${track}: ${current.length} steps, expected ${target.length}`);
  return target.flatMap((cell, step) => {
    const now = current[step];
    return now === undefined ? [] : stepGestures(track, bar, step, now, cell);
  });
}
