// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element, setText, setVar } from "../dom";
import type { ParameterView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";
import { bindRangeKeys } from "../../behavior/keyboard/range-keyboard";

export interface SliderRow {
  readonly root: HTMLElement;
  update(parameter: ParameterView): void;
}

const RESOLUTION = 1000;

/** The tag beside a parameter that tone moves: "overrides tone" or "follows tone"; empty otherwise. */
export function toneRoleText(role: ParameterView["toneRole"]): string {
  if (role === null) return "";
  return role === "overrides" ? strings.overridesTone : strings.followsTone;
}

/** One manifest or mix parameter; a signal shows its range in translucent flare. */
/** `onEnd`: the drag or the key press ended, so the next one is an undo step of its own. */
export function createSliderRow(id: string, name: string, onInput: (fraction: number) => void, onEnd: () => void = () => undefined): SliderRow {
  const inputId = `${id}-${name}`;
  const value = element("span", { className: "ui-slider__value", attributes: { id: `${inputId}-value` } });
  const input = element("input", {
    className: "ui-range ui-slider__input",
    attributes: { id: inputId, type: "range", min: 0, max: RESOLUTION, step: 1, "aria-describedby": `${inputId}-value` },
  });
  input.addEventListener("input", () => onInput(Number(input.value) / RESOLUTION));
  input.addEventListener("change", onEnd);
  bindRangeKeys(input);
  const tag = element("span", { className: "ui-slider__tone-role" });
  const root = element("div", { className: "ui-slider" }, [
    element("label", { className: "ui-slider__label", text: name, attributes: { for: inputId } }),
    tag,
    value,
    element("span", { className: "ui-slider__track" }, [input]),
  ]);
  return {
    root,
    update(parameter) {
      setText(value, parameter.display);
      // "overrides tone" / "follows tone": who Tone yields to.
      tag.hidden = parameter.toneRole === null;
      setText(tag, toneRoleText(parameter.toneRole));
      input.setAttribute("aria-valuetext", parameter.display);
      if (document.activeElement !== input) input.value = String(Math.round(parameter.fraction * RESOLUTION));
      setVar(root, "--fill", parameter.fraction);
      root.classList.toggle("has-signal", parameter.signal !== null);
      if (parameter.signal !== null) {
        setVar(root, "--signal-from", parameter.signal.from);
        setVar(root, "--signal-to", parameter.signal.to);
      }
    },
  };
}
