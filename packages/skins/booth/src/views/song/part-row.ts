// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setAttributes, setPressed, setText, setVar } from "../dom";
import { icon } from "../icons";
import type { RangeIntents } from "@untzel/skin-contract";
import { rangeStrings, strings } from "../../copy/copy";
import type { PartRangeState } from "../range/part-range-model";
import type { PartRowState } from "./part-row-state";

/** The editor every row opens, for aria-controls. */
export const PART_EDITOR_ID = "ui-part";

export interface PartRowNodes {
  readonly row: HTMLButtonElement;
  readonly name: HTMLElement;
  readonly meta: HTMLElement;
  readonly length: HTMLElement;
  readonly rangeText: HTMLElement;
  readonly toHere: HTMLButtonElement;
  readonly brackets: HTMLButtonElement;
  readonly play: HTMLButtonElement;
  readonly pencil: HTMLButtonElement;
}

export type PartRangeIntents = Pick<RangeIntents, "setRangeToPart" | "extendRangeToPart" | "playPart">;

/** The row's name: the part, then its place in the play range when it has one. */
export function partRowLabel(label: string, rangeText: string | null): string {
  return rangeText === null ? label : `${label}, ${rangeText}`;
}

/** One part's row and the buttons beside it, appended to `list`. */
export function createPartRow(list: HTMLElement, index: number, onOpen: (part: number) => void, onRename: (part: number) => void, intents: PartRangeIntents): PartRowNodes {
  const name = element("span", { className: "ui-partrow__name" });
  const meta = element("span", { className: "ui-partrow__meta" });
  const fill = element("span", { className: "ui-partrow__fill" });
  const length = element("span", { className: "ui-partrow__length", attributes: { "aria-hidden": "true" } }, [fill]);
  const rangeText = element("span", { className: "ui-partrow__range" });
  const row = button("ui-partrow", "", () => onOpen(index), [name, meta, length, rangeText]);
  setAttributes(row, { "aria-controls": PART_EDITOR_ID });
  const toHere = button("ui-pill ui-pill--raised ui-partrow__to-here", rangeStrings.toHere, () => intents.extendRangeToPart(index));
  const brackets = button("ui-round ui-partrow__brackets", "", () => intents.setRangeToPart(index), [icon("brackets")]);
  const play = button("ui-round ui-partrow__play", "", () => intents.playPart(index), [icon("play-part")]);
  const pencil = button("ui-round ui-partrow__rename", "", () => onRename(index), [icon("pencil")]);
  list.append(element("li", { className: "ui-song__item" }, [row, toHere, brackets, play, pencil]));
  return { row, name, meta, length, rangeText, toHere, brackets, play, pencil };
}

/** `tabIndex`: the row's roving tab stop, or null to leave it while the focus is in the list. */
export function updatePartRow(nodes: PartRowNodes, state: PartRowState, inRange: PartRangeState, tabIndex: number | null): void {
  setText(nodes.name, state.name);
  setText(nodes.meta, state.meta);
  setText(nodes.rangeText, inRange.text ?? "");
  nodes.row.setAttribute("aria-label", partRowLabel(state.label, inRange.text));
  nodes.pencil.setAttribute("aria-label", strings.renamePart(state.name));
  nodes.row.setAttribute("aria-expanded", String(state.isOpen));
  nodes.row.dataset["state"] = state.play ?? "none";
  nodes.row.dataset["range"] = inRange.role;
  setAttributes(nodes.row, { "aria-current": state.play === "playing" ? "true" : null });
  if (tabIndex !== null) nodes.row.tabIndex = tabIndex;
  setVar(nodes.length, "--length", state.length);
  setVar(nodes.length, "--progress", state.progress.toFixed(3));
  nodes.toHere.hidden = !inRange.canExtend;
  nodes.toHere.setAttribute("aria-label", inRange.extendLabel);
  nodes.brackets.setAttribute("aria-label", inRange.setLabel);
  nodes.play.setAttribute("aria-label", inRange.playLabel);
  setPressed(nodes.play, inRange.isPlayPressed);
}
