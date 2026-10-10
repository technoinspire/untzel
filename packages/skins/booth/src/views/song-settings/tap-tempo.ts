// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element } from "../dom";
import { icon } from "../icons";
import { text } from "../../copy/copy";
import { tapTempo, type TapState } from "./tempo-editor-model";

const TAP_DOTS = 4;

/** Tap tempo and its four dots, one lit per tap; enough taps give a tempo, written at once. */
export function createTapTempo(write: (bpm: number) => void): { readonly root: HTMLButtonElement; tap(at: number): void } {
  let taps: TapState = { taps: [], bpm: null };
  const dots = element("span", { className: "ui-tempo__dots", attributes: { "aria-hidden": "true" } }, Array.from({ length: TAP_DOTS }, () => element("span", { className: "ui-tempo__dot" })));
  const onTap = (at: number): void => {
    taps = tapTempo(taps, at);
    [...dots.children].forEach((dot, index) => dot.classList.toggle("is-on", index < taps.taps.length));
    if (taps.bpm !== null) write(taps.bpm);
  };
  const root = button("ui-pill ui-pill--raised ui-tempo__tap", text.tapTempo, () => onTap(performance.now()), [icon("target"), element("span", { text: text.tapTempo }), dots]);
  root.setAttribute("aria-keyshortcuts", "T");
  return { root, tap: onTap };
}
