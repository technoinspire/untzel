// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The transport's play range: the range row and the range ruler, and
// the one bit of gesture state between them, the first of two taps. A second tap, a drag
// released or a key sends the range (a key without an announcement: the slider already
// says its value); Cancel, Esc or hiding the controls drops the first tap. "Play from
// here" is a button the transport places with its actions.
import { button, element } from "../dom";
import { icon } from "../icons";
import type { RangeIntents } from "@untzel/skin-contract";
import type { PlayRangeView } from "@untzel/presentation/view-model";
import { rangeText, text } from "../../copy/copy";
import { createRangeRow } from "./range-row";
import { createRangeRuler } from "./range-ruler";
import { createPendingTap, isOtherRuler } from "./range-strip-pending";
import { barScale, songTapSpan, spanOfEdges, startOfTap, tapBar, transportRulerView, type EditingBarView } from "./range-ruler-model";

export interface RangeStrip {
  readonly root: HTMLElement;
  /** Shown in the actions while a first tap waits: the music plays from that bar. */
  readonly playFrom: HTMLButtonElement;
  update(view: PlayRangeView, editing: EditingBarView | null): void;
  /** Drops a first tap (hiding the controls, a mode change). */
  cancelPending(): void;
}

// Over 40 lines: one strip built and drawn; the row and the ruler share the first tap.
export function createRangeStrip(intents: RangeIntents, onPending: (isPending: boolean) => void): RangeStrip {
  let view: PlayRangeView | null = null;
  let editing: EditingBarView | null = null;
  const root = element("div", { className: "ui-range-strip" });
  const pending = createPendingTap(root, onPending, () => redraw());
  const setPending = pending.set;
  const ruler = createRangeRuler(rangeText.playRange, {
    onEdges: (edges, gesture) => {
      // The music changes on the next bar: a range is sent when the drag is let go.
      if (gesture === "drag") return;
      setPending(null);
      const span = spanOfEdges(edges);
      intents.setPlayRange(span.startBar, span.endBar, gesture);
    },
    onTap: (bar) => {
      if (view === null) return;
      const first = pending.bar();
      const result = tapBar(first, bar);
      if (result.kind === "pending") return setPending(result.bar);
      const span = view.mode === "song" && first !== null ? songTapSpan(view.parts, first, bar) : result.span;
      setPending(null);
      if (span !== null) intents.setPlayRange(span.startBar, span.endBar, "release");
    },
  });
  const row = createRangeRow({
    onClear: () => {
      intents.clearPlayRange();
      ruler.root.querySelector<HTMLElement>("[data-handle='start']")?.focus();
    },
    onCancel: () => setPending(null),
    onCycle: (cycle) => intents.setRangeCycle(cycle),
  });
  const playFrom = button("ui-pill ui-pill--raised ui-range-strip__play-from", text.playFromHere, () => {
    const first = pending.bar();
    const bar = first === null || view === null ? null : startOfTap(view, first);
    setPending(null);
    if (bar !== null) intents.playFrom(bar);
  }, [icon("play-from"), element("span", { text: text.playFromHere })]);
  playFrom.removeAttribute("aria-label");
  playFrom.hidden = true;
  root.append(row.root, ruler.root);
  function redraw(): void {
    if (view === null) return;
    const first = pending.bar();
    row.update(view, first);
    ruler.update(transportRulerView(view, first, editing), barScale(view));
    playFrom.hidden = first === null;
  }
  return {
    root,
    playFrom,
    update(next, nextEditing) {
      // Another ruler: the waiting bar may not exist on it.
      const isOther = isOtherRuler(view, next);
      view = next;
      editing = nextEditing;
      if (isOther) pending.drop();
      redraw();
    },
    cancelPending: () => setPending(null),
  };
}
