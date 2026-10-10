// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The layers the range ruler draws: its handles, the cells (bars or parts), the
// outline of the bar in edit and the bar numbers.
import { element, setText, setVar } from "../dom";
import { rangeText } from "../../copy/copy";
import { edgeGeometry, type Handle, type RulerView } from "./ruler-geometry";

/** A bracket handle: a slider for the keyboard. */
export function slider(handle: Handle): HTMLElement {
  return element("span", {
    className: "ui-range-ruler__handle",
    attributes: {
      role: "slider",
      tabindex: 0,
      "aria-label": handle === "start" ? rangeText.rangeStart : rangeText.rangeEnd,
      "aria-orientation": "horizontal",
      "data-handle": handle,
    },
  });
}

/** The ruler's blocks: each part of the song with its name, or each bar of the loop unnamed. */
export function rulerBlocks(view: Pick<RulerView, "mode" | "parts">, lastBar: number): readonly { readonly startBar: number; readonly endBar: number; readonly name: string }[] {
  return view.mode === "song" ? view.parts : Array.from({ length: lastBar }, (_, index) => ({ startBar: index + 1, endBar: index + 1, name: "" }));
}

/** One cell per bar in loop mode; one block per part in song mode, with its name. */
export function drawCells(cells: HTMLElement, view: RulerView, lastBar: number): void {
  const blocks = rulerBlocks(view, lastBar);
  syncChildren(cells, blocks.length, "ui-range-ruler__cell");
  blocks.forEach((block, index) => {
    const cell = cells.children[index];
    if (!(cell instanceof HTMLElement)) return;
    const { left, width } = edgeGeometry({ start: block.startBar - 1, end: block.endBar }, lastBar);
    setVar(cell, "--left", left.toFixed(5));
    setVar(cell, "--width", width.toFixed(5));
    setText(cell, block.name);
  });
}

/** The bar-in-edit outline: flare, 2 px, a 2 px stage gap, on each bar that plays the bar in edit. */
export function drawEditing(editing: HTMLElement, bars: readonly number[], lastBar: number): void {
  syncChildren(editing, bars.length, "ui-range-ruler__edit");
  bars.forEach((bar, index) => {
    const node = editing.children[index];
    if (!(node instanceof HTMLElement)) return;
    const { left, width } = edgeGeometry({ start: bar - 1, end: bar }, lastBar);
    setVar(node, "--left", left.toFixed(5));
    setVar(node, "--width", width.toFixed(5));
  });
}

/** The bar numbers under the ruler, the strong ones marked. */
export function drawNumbers(numbers: HTMLElement, view: RulerView, lastBar: number): void {
  syncChildren(numbers, view.numbers.length, "ui-range-ruler__number");
  view.numbers.forEach((mark, index) => {
    const node = numbers.children[index];
    if (!(node instanceof HTMLElement)) return;
    setText(node, String(mark.bar));
    setVar(node, "--at", ((mark.bar - 0.5) / lastBar).toFixed(5));
    node.classList.toggle("is-strong", mark.isStrong);
  });
}

/** `count` children of `className`, added or removed at the end. */
function syncChildren(parent: HTMLElement, count: number, className: string): void {
  while (parent.children.length < count) parent.append(element("span", { className }));
  while (parent.children.length > count) parent.lastElementChild?.remove();
}
