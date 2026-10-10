// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { StepView } from "@untzel/presentation/view-model";

export type MiniCell = "hit" | "hold" | "rest";

/** The tile miniature always shows 16 slots of one bar. */
export const MINI_STEPS = 16;

/**
 * Maps one bar of any step count onto 16 slots by time: an 8-step pattern puts step i
 * at slot 2i, a 32-step pattern folds two steps into one slot (a hit wins).
 */
export function miniSteps(steps: readonly StepView[]): readonly MiniCell[] {
  const cells: MiniCell[] = Array.from({ length: MINI_STEPS }, () => "rest");
  if (steps.length === 0) return cells;
  const slotsPerStep = MINI_STEPS / steps.length;
  steps.forEach((step, index) => {
    const start = Math.floor(index * slotsPerStep);
    const end = Math.max(start + 1, Math.floor((index + 1) * slotsPerStep));
    const cell = cellOf(step);
    for (let slot = start; slot < end && slot < MINI_STEPS; slot += 1) {
      const isFirst = slot === start;
      const value: MiniCell = cell === "hit" && !isFirst ? "rest" : cell;
      if (cells[slot] !== "hit") cells[slot] = value;
    }
  });
  return cells;
}

function cellOf(step: StepView): MiniCell {
  switch (step.kind) {
    case "rest":
      return "rest";
    case "hold":
      return "hold";
    default:
      return "hit";
  }
}
