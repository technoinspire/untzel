// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The range row over the ruler: the chip "Range: bars 3–6" with its
// own × (44 px), or "Whole loop · drag a handle or tap two bars"; the loop's note or the
// song's Cycle switch and sentence; and, after a first tap, "From bar 3: tap the end bar"
// with Cancel in the chip's place; on the desktop, in the loop, the ruler's key under the
// chip, which the CSS shows in the note's place. Words come from
// range-row-model.ts.
import { button, element, setAttributes, setText } from "../dom";
import { icon } from "../icons";
import type { PlayRangeView } from "@untzel/presentation/view-model";
import { rangeStrings, rangeText, text } from "../../copy/copy";
import { pendingHint, rangeRowState } from "./range-row-model";

export interface RangeRowEvents {
  readonly onClear: () => void;
  readonly onCancel: () => void;
  readonly onCycle: (cycle: boolean) => void;
}

export interface RangeRow {
  readonly root: HTMLElement;
  /** Where the focus goes after × clears the range. */
  readonly clear: HTMLButtonElement;
  update(view: PlayRangeView, pendingBar: number | null): void;
}

// Over 40 lines: one row built and updated, nothing else.
export function createRangeRow(events: RangeRowEvents): RangeRow {
  const chipLabel = element("span", { className: "ui-range-row__label" });
  const chipIcon = icon("brackets");
  chipIcon.classList.add("ui-range-row__brackets");
  const clear = button("ui-range-row__clear", rangeText.clearRange, () => events.onClear(), [icon("close")]);
  const chip = element("div", { className: "ui-range-row__chip" }, [chipIcon, chipLabel, clear]);
  const hint = element("p", { className: "ui-range-row__hint", attributes: { role: "status" } });
  const cancel = button("ui-pill ui-pill--raised ui-range-row__cancel", text.cancel, () => events.onCancel());
  // "Cycle", the switch, and On or Off written out: the state is never colour alone.
  const cycleState = element("span", { className: "ui-range-row__cycle-state", attributes: { "aria-hidden": "true" } });
  let cycle = true;
  const cycleRow = button("ui-switch ui-range-row__cycle", rangeText.cycle, () => events.onCycle(!cycle), [
    element("span", { text: rangeText.cycle, attributes: { "aria-hidden": "true" } }),
    element("span", { className: "ui-switch__track", attributes: { "aria-hidden": "true" } }),
    cycleState,
  ]);
  setAttributes(cycleRow, { role: "switch" });
  const note = element("p", { className: "ui-range-row__note" });
  // The states are also said by the handles' values and the bar thumbnails: a visual key only.
  const legend = element("p", { className: "ui-range-row__legend", text: rangeText.legend, attributes: { "aria-hidden": "true" } });
  const root = element("div", { className: "ui-range-row" }, [chip, hint, cancel, cycleRow, note, legend]);
  return {
    root,
    clear,
    update(view, pendingBar) {
      const state = rangeRowState(view);
      const isPending = pendingBar !== null;
      root.dataset["pending"] = String(isPending);
      root.dataset["range"] = String(state.hasRange);
      root.dataset["mode"] = view.mode;
      chip.hidden = isPending;
      setText(chipLabel, state.chip);
      clear.hidden = !state.hasRange;
      hint.hidden = !isPending;
      cancel.hidden = !isPending;
      setText(hint, isPending ? pendingHint(view, pendingBar) : "");
      cycle = state.cycle;
      cycleRow.hidden = !state.isCycleShown || isPending;
      cycleRow.setAttribute("aria-checked", String(state.cycle));
      setText(cycleState, state.cycle ? rangeStrings.on : rangeStrings.off);
      note.hidden = state.note === null || isPending;
      setText(note, state.note ?? "");
    },
  };
}
