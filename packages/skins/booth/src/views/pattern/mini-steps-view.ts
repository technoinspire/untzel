// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element } from "../dom";
import { MINI_STEPS, miniSteps } from "./mini-steps";
import type { StepView } from "@untzel/presentation/view-model";

/** 16-slot miniature, decorative: the step grid in the detail is the accessible one. */
export function createMiniSteps(className: string): HTMLElement {
  const cells = Array.from({ length: MINI_STEPS }, () => element("span", { className: "ui-mini__cell" }));
  return element("span", { className: `ui-mini ${className}`, attributes: { "aria-hidden": "true" } }, cells);
}

export function updateMiniSteps(node: HTMLElement, steps: readonly StepView[]): void {
  const cells = miniSteps(steps);
  cells.forEach((cell, index) => {
    const child = node.children[index];
    if (child instanceof HTMLElement && child.dataset["cell"] !== cell) child.dataset["cell"] = cell;
  });
}
