// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element, setText } from "../dom";
import type { BarIntents } from "@untzel/skin-contract";
import { stepRowsCaption } from "../../behavior/text/lengths";
import type { TrackView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";
import { bindSwipe } from "../../behavior/gestures/swipe";
import { createBarActions } from "./bar-actions";
import { clampedBar, createBarEditingHeader } from "./bar-editing-header";
import { loopReachNote } from "./bar-thumb-state";
import { createBarThumbs } from "./bar-thumbs";
import { createStepGrid } from "../pattern/step-grid";

// Which bar is edited and its steps: the bar
// thumbnails, "Editing bar 2 of 4" between the arrows (and a sideways swipe), the grid of
// that bar only with "steps 1–8 · 9–16 of bar 2", and Copy bar, Paste here, Clear bar.
// With a 1-bar pattern the thumbnails and the header are not shown. A change of the bar
// being edited is said through the shell's polite region (`announce`), not a live region
// of its own.

export interface BarEditor {
  readonly root: HTMLElement;
  /** The bar the grid shows; the bar that sounds is marked apart. */
  readonly editingBar: number;
  /** `selectedStep` rings the step the note picker edits; null for drums. */
  /** `audible`: how many bars play; fewer than the pattern's under a shorter loop. */
  update(track: TrackView, isDesktop: boolean, selectedStep: number | null, audible: number): void;
  focusStep(index: number): void;
}

// Over 40 lines: one editor built and drawn; its header, thumbnails, grid and actions are their own views.
export function createBarEditor(
  intents: BarIntents,
  onStep: (bar: number, step: number) => void,
  announce: (message: string) => void,
  onEditingBar: () => void,
): BarEditor {
  let current: TrackView | null = null;
  /** True until the first render of a track: opening the detail is not a change to say. */
  let isFreshTrack = true;
  let editingBar = 0;
  let selected: number | null = null;
  let audibleBars = 1;

  const editBar = (bar: number): void => {
    if (current === null) return;
    editingBar = clampedBar(bar, current.bars);
    render(current);
    onEditingBar();
  };
  const thumbs = createBarThumbs(editBar);
  const legend = element("p", { className: "ui-detail__legend", attributes: { "aria-hidden": "true" } }, [
    element("span", { className: "ui-detail__legend-playing", text: strings.barsLegendPlaying }),
    element("span", { className: "ui-detail__legend-editing", text: strings.barsLegendEditing }),
  ]);
  const reach = element("p", { className: "ui-detail__reach" });
  const barsBlock = element("div", { className: "ui-detail__bars" }, [
    element("p", { className: "ui-detail__label", text: strings.bars }),
    thumbs.root,
    legend,
    reach,
  ]);
  const header = createBarEditingHeader(announce, (delta) => editBar(editingBar + delta));
  const grid = createStepGrid((step) => onStep(editingBar, step));
  const caption = element("p", { className: "ui-detail__caption" });
  const actions = createBarActions(intents, () => current, () => editingBar, () => {
    if (current !== null) render(current);
  });
  // Swipe on the grid and its header, sideways only: a vertical drag still scrolls.
  const swipeArea = element("div", { className: "ui-detail__bar-editor" }, [header.root, grid.root, caption]);
  bindSwipe(swipeArea, (direction) => {
    if ((current?.bars ?? 1) > 1) editBar(editingBar + direction);
  });
  const root = element("div", { className: "ui-detail__bar-block" }, [barsBlock, swipeArea, actions.root]);

  function render(track: TrackView): void {
    const isSingle = track.bars <= 1;
    barsBlock.hidden = isSingle;
    header.root.hidden = isSingle;
    thumbs.update(track, editingBar, audibleBars);
    const note = loopReachNote(track.bars, audibleBars);
    reach.hidden = note === null;
    setText(reach, note ?? "");
    header.render(editingBar, track.bars, isSingle || isFreshTrack);
    isFreshTrack = false;
    const steps = track.patternBars[editingBar] ?? track.steps;
    setText(caption, stepRowsCaption(steps.length, editingBar));
    grid.update({ track: track.name, bar: editingBar, steps, selected });
    actions.render(track, editingBar);
  }

  return {
    root,
    get editingBar() {
      return editingBar;
    },
    update(track, isDesktop, selectedStep, audible) {
      if (current?.name !== track.name) {
        editingBar = 0;
        isFreshTrack = true;
      }
      editingBar = Math.min(editingBar, track.bars - 1);
      current = track;
      selected = selectedStep;
      audibleBars = audible;
      header.setHint(isDesktop);
      render(track);
    },
    focusStep: (index) => grid.focusStep(index),
  };
}
