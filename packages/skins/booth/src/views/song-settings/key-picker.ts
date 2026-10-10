// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ScaleName } from "@untzel/core";
import { element, setAttributes, setText, setVar } from "../dom";
import { icon } from "../icons";
import type { StatementIntents } from "@untzel/skin-contract";
import type { TransportView } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";
import { keyPickerModel, scaleDescription, type KeyPickerModel } from "./key-picker-model";
import { TOP_BAR_PX, popoverPosition } from "../primitives/popover-position";
import { createSheet, type Sheet } from "../sheets/sheet";

// The key picker the key of the transport opens: 12 tonics and 5
// scales as radio groups, the chosen one with a flare outline and ✓. Writes `key d dorian`
// on the next bar; the music never stops.

export interface KeyPicker extends Sheet {
  update(transport: TransportView): void;
  anchor(rect: DOMRect | null): void;
}

function radio(className: string, label: string, onPick: () => void, extra: readonly Node[] = []): HTMLButtonElement {
  const node = element("button", { className, attributes: { type: "button", role: "radio" } }, [icon("check"), element("span", { text: label }), ...extra]);
  node.addEventListener("click", onPick);
  return node;
}

/** Arrows move within a radio group, as WAI-ARIA asks. */
function arrowKeys(group: HTMLElement): void {
  group.addEventListener("keydown", (event) => {
    const items = [...group.querySelectorAll<HTMLButtonElement>("[role='radio']")];
    const index = items.indexOf(event.target as HTMLButtonElement);
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (index < 0 || delta === 0) return;
    event.preventDefault();
    items[(index + delta + items.length) % items.length]?.focus();
  });
}

// Over 40 lines: one picker built, updated and anchored, nothing else.
export function createKeyPicker(intents: StatementIntents, onClose: () => void): KeyPicker {
  const sheet = createSheet({ id: "ui-key", title: text.key, className: "ui-sheet--popover ui-sheet--key", onClose });
  let tonic = "c";
  let scale: ScaleName = "minor";
  let model: KeyPickerModel = keyPickerModel(tonic, scale);
  const tonics = element("div", { className: "ui-key__tonics", attributes: { role: "radiogroup", "aria-label": text.tonic } }, model.tonics.map((option) =>
    radio("ui-key__tonic", option.label, () => intents.setKey(option.text, scale)),
  ));
  const scales = element("div", { className: "ui-key__scales", attributes: { role: "radiogroup", "aria-label": text.scale } }, model.scales.map((option) =>
    radio("ui-key__scale", option.scale, () => intents.setKey(tonic, option.scale), [element("span", { className: "ui-key__description", text: () => scaleDescription(option.scale) })]),
  ));
  arrowKeys(tonics);
  arrowKeys(scales);
  const note = element("p", { className: "ui-sheet__hint ui-key__note" });
  sheet.body.append(tonics, scales, note);

  const mark = (group: HTMLElement, chosen: readonly boolean[]): void => {
    [...group.children].forEach((node, index) => {
      const isChosen = chosen[index] === true;
      setAttributes(node, { "aria-checked": String(isChosen), tabindex: isChosen ? 0 : -1 });
    });
  };
  return {
    ...sheet,
    update(transport) {
      tonic = transport.keyTonic;
      scale = transport.keyScale;
      model = keyPickerModel(tonic, scale);
      mark(tonics, model.tonics.map((option) => option.isChosen));
      mark(scales, model.scales.map((option) => option.isChosen));
      setText(note, model.note);
    },
    anchor(rect) {
      if (rect === null) return;
      const { left, top } = popoverPosition(rect, { width: sheet.root.offsetWidth, height: sheet.root.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, TOP_BAR_PX);
      setVar(sheet.root, "--anchor-left", `${left}px`);
      setVar(sheet.root, "--anchor-top", `${top}px`);
    },
  };
}
