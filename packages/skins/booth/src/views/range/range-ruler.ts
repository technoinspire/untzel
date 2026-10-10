// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The range ruler: the loop's bars, or the song's parts, with
// a range as a band between two bracket handles, the bar that plays as a white needle and
// the bar in edit outlined in flare. The transport's play range and the export's stretch
// both draw it; their RulerScale says how the handles move (whole bars, or steps). A drag
// shows its value over the handle and sends the edges as it moves and on release; a tap
// (under 6 px of movement, also on a handle) is a tap on the bar under it; each handle is a
// slider for the keyboard. Holds only the gesture in flight; what it draws comes from the
// view model.
import { element, setAttributes, setText, setVar } from "../dom";
import type { Label } from "../../copy/copy";
import { drawCells, drawEditing, drawNumbers, slider } from "./range-ruler-layers";
import { bindRulerKeys, type RangeRulerEvents } from "./range-ruler-keys";
import { bindRulerPointer } from "./range-ruler-pointer";
import { edgeGeometry, type Edges, type Handle, type RulerScale, type RulerView } from "./ruler-geometry";

export type { RangeRulerEvents };

export interface RangeRuler {
  readonly root: HTMLElement;
  update(view: RulerView, scale: RulerScale): void;
}

// Over 40 lines: one ruler built and drawn; its layers, pointer and keys are their own modules.
export function createRangeRuler(label: Label, events: RangeRulerEvents): RangeRuler {
  const cells = element("span", { className: "ui-range-ruler__cells", attributes: { "aria-hidden": "true" } });
  const band = element("span", { className: "ui-range-ruler__band", attributes: { "aria-hidden": "true" } });
  const pending = element("span", { className: "ui-range-ruler__pending", attributes: { "aria-hidden": "true" } });
  const editing = element("span", { className: "ui-range-ruler__editing", attributes: { "aria-hidden": "true" } });
  const needle = element("span", { className: "ui-range-ruler__needle", attributes: { "aria-hidden": "true" } });
  const value = element("span", { className: "ui-range-ruler__value", attributes: { "aria-hidden": "true" } });
  const handles: Record<Handle, HTMLElement> = { start: slider("start"), end: slider("end") };
  const track = element("div", { className: "ui-range-ruler__track" }, [cells, editing, band, pending, needle, handles.start, handles.end, value]);
  const numbers = element("div", { className: "ui-range-ruler__numbers", attributes: { "aria-hidden": "true" } });
  const root = element("div", { className: "ui-range-ruler", attributes: { role: "group", "aria-label": label } }, [track, numbers]);
  value.hidden = true;
  let view: RulerView | null = null;
  let scale: RulerScale | null = null;

  const drawEdges = (edges: Edges): void => {
    const { left, width } = edgeGeometry(edges, view?.lastBar ?? 1);
    setVar(band, "--left", left.toFixed(5));
    setVar(band, "--width", width.toFixed(5));
    setVar(handles.start, "--at", left.toFixed(5));
    setVar(handles.end, "--at", (left + width).toFixed(5));
  };
  const showValue = (handle: Handle | null, edges: Edges | null): void => {
    value.hidden = handle === null || edges === null || scale === null;
    if (handle === null || edges === null || scale === null) return;
    setText(value, scale.dragLabel(handle, edges));
    value.dataset["handle"] = handle;
    setVar(value, "--at", ((handle === "start" ? edges.start : edges.end) / Math.max(1, view?.lastBar ?? 1)).toFixed(5));
  };
  const isPressing = bindRulerPointer(track, events, () => view, () => scale, drawEdges, showValue);
  bindRulerKeys(handles, events, () => view, () => scale);

  return {
    root,
    update(next, nextScale) {
      view = next;
      scale = nextScale;
      root.dataset["mode"] = next.mode;
      root.dataset["range"] = String(next.hasRange);
      const lastBar = Math.max(1, next.lastBar);
      drawCells(cells, next, lastBar);
      if (!isPressing()) drawEdges(next.edges);
      band.hidden = !next.hasRange;
      needle.hidden = next.playhead === null;
      if (next.playhead !== null) setVar(needle, "--at", next.playhead.toFixed(5));
      pending.hidden = next.pending === null;
      if (next.pending !== null) {
        const { left, width } = edgeGeometry(next.pending, lastBar);
        setVar(pending, "--left", left.toFixed(5));
        setVar(pending, "--width", width.toFixed(5));
      }
      drawEditing(editing, next.editingBars, lastBar);
      for (const handle of ["start", "end"] as const) {
        const shown = next.handles[handle];
        setAttributes(handles[handle], {
          "aria-valuemin": shown.min,
          "aria-valuemax": shown.max,
          "aria-valuenow": shown.now,
          "aria-valuetext": shown.valueText,
          "aria-disabled": next.isInert ? "true" : null,
        });
      }
      drawNumbers(numbers, next, lastBar);
    },
  };
}
