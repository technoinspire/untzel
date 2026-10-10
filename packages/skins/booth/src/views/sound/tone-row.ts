// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setAttributes, setText, setVar } from "../dom";
import { icon } from "../icons";
import type { ToneSetByView } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";
import { bindRangeKeys } from "../../behavior/keyboard/range-keyboard";
import { toneRowModel, type SetByPart } from "./tone-row-model";

// The Tone slider of the track detail. Overridden by a written
// parameter, it is shown inactive: dashed track, hollow thumb, aria-disabled, the value
// does not move, and "Set by open" with Use Tone, which hands control back.

export interface ToneRowCallbacks {
  readonly onTone: (fraction: number) => void;
  readonly onUseTone: () => void;
  /** The drag ended: one undo step. */
  readonly onEnd: () => void;
}

export interface ToneRow {
  readonly root: HTMLElement;
  update(tone: number, setBy: readonly ToneSetByView[]): void;
}

const RESOLUTION = 1000;
const INPUT_ID = "ui-detail-tone";

/** The range input; inactive, the thumb stays where the written value puts it. */
function createToneInput(callbacks: ToneRowCallbacks, state: { isActive: boolean; position: number }): HTMLInputElement {
  const input = element("input", {
    className: "ui-range ui-slider__input",
    attributes: { id: INPUT_ID, type: "range", min: 0, max: RESOLUTION, step: 1, "aria-describedby": `${INPUT_ID}-value ${INPUT_ID}-set-by` },
  });
  input.addEventListener("input", () => {
    if (!state.isActive) input.value = String(Math.round(state.position * RESOLUTION));
    else callbacks.onTone(Number(input.value) / RESOLUTION);
  });
  input.addEventListener("change", () => callbacks.onEnd());
  bindRangeKeys(input);
  return input;
}

export function createToneRow(callbacks: ToneRowCallbacks): ToneRow {
  const state = { isActive: true, position: 0.5 };
  const value = element("span", { className: "ui-slider__value", attributes: { id: `${INPUT_ID}-value` } });
  const setBy = element("span", { className: "ui-tone__set-by", attributes: { id: `${INPUT_ID}-set-by` } });
  const input = createToneInput(callbacks, state);
  const use = button("ui-pill ui-pill--raised ui-tone__use", text.useTone, () => callbacks.onUseTone());
  const note = element("p", { className: "ui-tone__note" });
  const action = element("div", { className: "ui-tone__action" }, [use, note]);
  const root = element("div", { className: "ui-slider ui-tone" }, [
    element("label", { className: "ui-slider__label", text: text.tone, attributes: { for: INPUT_ID } }),
    value,
    setBy,
    element("span", { className: "ui-slider__track" }, [input]),
    action,
  ]);

  return {
    root,
    update(tone, overrides) {
      const model = toneRowModel(tone, overrides);
      state.isActive = model.isActive;
      state.position = tone;
      root.classList.toggle("is-overridden", !model.isActive);
      setAttributes(input, { "aria-disabled": model.isActive ? null : "true", "aria-valuetext": model.setBy ?? model.display });
      setText(value, model.display);
      value.hidden = !model.isActive;
      setBy.hidden = model.isActive;
      setBy.replaceChildren(...(model.isActive ? [] : [icon("link"), setByText(model.setByParts)]));
      action.hidden = model.isActive;
      setText(note, model.useNote ?? "");
      if (document.activeElement !== input) input.value = String(Math.round(tone * RESOLUTION));
      setVar(root, "--fill", tone);
    },
  };
}

/** "Set by open": the model's pieces; the parameter names in code type. */
function setByText(parts: readonly SetByPart[]): HTMLElement {
  return element(
    "span",
    {},
    parts.map((part) => (part.isCode ? element("code", { text: part.text }) : document.createTextNode(part.text))),
  );
}
