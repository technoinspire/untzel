// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setPressed } from "../dom";
import { stepName } from "../../behavior/text/format";
import type { StepView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";

// The steps of the bar being edited, 8 per row. A drum step toggles
// on a tap; a melodic step opens the note picker, so its
// selection ring shows which step the picker edits.

const STEPS_PER_ROW = 8;

export interface StepGridState {
  readonly track: string;
  readonly bar: number;
  readonly steps: readonly StepView[];
  /** The step the note picker edits; null on drum tracks. */
  readonly selected: number | null;
}

export interface StepGrid {
  readonly root: HTMLElement;
  update(state: StepGridState): void;
  /** Focus goes back here when the note picker closes. */
  focusStep(index: number): void;
}

/** A step shows its note or chord; it is pressed unless it rests. */
export function stepCellState(step: StepView): { readonly text: string; readonly isOn: boolean } {
  return { text: step.kind === "note" || step.kind === "chord" ? (step.label ?? "") : "", isOn: step.kind !== "rest" };
}

export function createStepGrid(onStep: (index: number) => void): StepGrid {
  const root = element("div", { className: "ui-steps", attributes: { role: "table", "aria-label": strings.stepGrid } });
  const cell = (step: StepView, index: number, selected: number | null): HTMLElement => {
    const node = button("ui-step", stepName(index, step), () => onStep(index));
    const state = stepCellState(step);
    node.textContent = state.text;
    node.setAttribute("aria-label", stepName(index, step));
    node.dataset["kind"] = step.kind;
    node.dataset["index"] = String(index);
    setPressed(node, state.isOn);
    node.classList.toggle("is-selected", index === selected);
    return element("span", { attributes: { role: "cell" } }, [node]);
  };
  const stepButton = (index: number): HTMLElement | null => root.querySelector<HTMLElement>(`.ui-step[data-index="${index}"]`);

  return {
    root,
    update(state) {
      const signature = `${state.track}|${state.bar}|${state.selected}|${state.steps.map((step) => step.label ?? step.kind).join(" ")}`;
      if (root.dataset["signature"] === signature) return;
      root.dataset["signature"] = signature;
      root.setAttribute("aria-label", `${strings.stepGrid}, bar ${state.bar + 1}`);
      const active = document.activeElement;
      const focused = active instanceof HTMLElement && root.contains(active) ? active.dataset["index"] : undefined;
      const rows: HTMLElement[] = [];
      for (let start = 0; start < state.steps.length; start += STEPS_PER_ROW) {
        const cells = state.steps.slice(start, start + STEPS_PER_ROW).map((step, offset) => cell(step, start + offset, state.selected));
        rows.push(element("div", { className: "ui-steps__row", attributes: { role: "row" } }, cells));
      }
      root.replaceChildren(...rows);
      if (focused !== undefined) stepButton(Number(focused))?.focus();
    },
    focusStep(index) {
      stepButton(index)?.focus({ preventScroll: true });
    },
  };
}
