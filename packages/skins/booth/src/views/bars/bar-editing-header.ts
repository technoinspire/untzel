// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setAttributes, setText } from "../dom";
import { icon } from "../icons";
import { editingLabel } from "../../behavior/text/lengths";
import { createSpokenText } from "../../behavior/feedback/spoken-text";
import { strings } from "../../copy/copy";

/** The bar to edit after a move, kept inside the pattern. */
export function clampedBar(bar: number, bars: number): number {
  return Math.max(0, Math.min(bars - 1, bar));
}

/** "Editing bar 2 of 4" between the previous and next arrows, which stop at the ends; said when it changes. */
export function createBarEditingHeader(announce: (message: string) => void, editBar: (delta: -1 | 1) => void): {
  readonly root: HTMLElement;
  render(editingBar: number, bars: number, isQuiet: boolean): void;
  setHint(isDesktop: boolean): void;
} {
  const spokenTitle = createSpokenText(announce);
  const previous = button("ui-round ui-round--raised ui-detail__previous", strings.goPreviousBar, () => editBar(-1), [icon("back")]);
  const next = button("ui-round ui-round--raised ui-detail__next", strings.goNextBar, () => editBar(1), [icon("forward")]);
  const title = element("p", { className: "ui-detail__editing" });
  const hint = element("p", { className: "ui-detail__editing-hint" });
  return {
    root: element("div", { className: "ui-detail__editing-row" }, [
      previous,
      element("div", { className: "ui-detail__editing-text" }, [title, hint]),
      next,
    ]),
    render(editingBar, bars, isQuiet) {
      const editing = editingLabel(editingBar, bars);
      setText(title, editing);
      if (isQuiet) spokenTitle.settle(editing);
      else spokenTitle.say(editing);
      setAttributes(previous, { "aria-disabled": editingBar <= 0 ? "true" : null });
      setAttributes(next, { "aria-disabled": editingBar >= bars - 1 ? "true" : null });
    },
    setHint: (isDesktop) => setText(hint, isDesktop ? strings.arrowsHint : strings.swipeHint),
  };
}
