// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element, setAttributes, setText, setVar } from "../dom";
import type { ParameterView } from "@untzel/presentation/view-model";
import { bindFaderGesture, type GainFaderCallbacks } from "./fader-gesture";
import { GAIN_MARKS, faderLegend } from "./gain-fader-model";

// The gain of the Mix group as a console fader in dB: Off, −60 to
// +6 dB, 0 dB at 75 %. A slider role over a drawn track, so a drag can be fine (Shift or
// Alt) and a double tap can reset; the label and aria-valuetext come in dB from the
// adapter ("−6.0 dB", "Off"). Arrows move 0.5 dB through the session, never here.

export type { GainFaderCallbacks };

export interface GainFader {
  readonly root: HTMLElement;
  update(gain: ParameterView): void;
}

/**
 * One fader built and updated; its gestures are fader-gesture.ts. Every number (position,
 * steps, legend, marks) comes from gain-fader-model.ts, tested without the DOM.
 */
// Over 40 lines: one fader built and updated, nothing else.
export function createGainFader(callbacks: GainFaderCallbacks): GainFader {
  const valueId = "ui-mix-gain-value";
  const value = element("span", { className: "ui-slider__value", attributes: { id: valueId } });
  const thumb = element("span", { className: "ui-fader__thumb", attributes: { "aria-hidden": "true" } });
  const slider = element("div", {
    className: "ui-fader__slider",
    attributes: { role: "slider", tabindex: 0, "aria-label": "gain", "aria-valuemin": 0, "aria-valuemax": 100, "aria-describedby": valueId },
  }, [element("span", { className: "ui-fader__rail", attributes: { "aria-hidden": "true" } }), thumb]);
  const marks = element("div", { className: "ui-fader__marks", attributes: { "aria-hidden": "true" } }, GAIN_MARKS.map((mark) => {
    const node = element("span", { className: `ui-fader__mark${mark.isUnity ? " is-unity" : ""}${mark.isWideOnly ? " is-wide-only" : ""}`, text: mark.label });
    setVar(node, "--at", mark.position);
    return node;
  }));
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const legend = element("p", { className: "ui-fader__legend", text: () => faderLegend(isTouch) });
  const root = element("div", { className: "ui-slider ui-fader" }, [
    element("span", { className: "ui-slider__label", text: "gain", attributes: { "aria-hidden": "true" } }),
    value,
    slider,
    marks,
    legend,
  ]);

  let current: ParameterView | null = null;
  const show = (position: number): void => setVar(root, "--fill", position);
  const isDragging = bindFaderGesture(slider, callbacks, () => current, show);

  return {
    root,
    update(gain) {
      current = gain;
      setText(value, gain.display);
      setAttributes(slider, { "aria-valuenow": Math.round(gain.fraction * 100), "aria-valuetext": gain.display });
      root.classList.toggle("has-signal", gain.signal !== null);
      if (gain.signal !== null) {
        setVar(root, "--signal-from", gain.signal.from);
        setVar(root, "--signal-to", gain.signal.to);
      }
      if (!isDragging()) show(gain.fraction);
    },
  };
}
