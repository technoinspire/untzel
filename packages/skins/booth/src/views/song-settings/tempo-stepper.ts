// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button } from "../dom";
import { icon } from "../icons";
import type { Label } from "../../copy/copy";

/** Holding − or + repeats 8 times a second after 400 ms. */
const REPEAT_DELAY_MS = 400;
const REPEAT_MS = 125;

/** − or + of the tempo editor: a press steps once, holding repeats; a keyboard click steps once. */
export function createTempoStepper(label: Label, name: "minus" | "plus", step: () => void): HTMLButtonElement {
  let timer = 0;
  const stop = (): void => window.clearTimeout(timer);
  const node = button("ui-round ui-round--raised ui-tempo__step", label, (event) => {
    if (event.detail === 0) step();
  }, [icon(name)]);
  node.addEventListener("pointerdown", () => {
    step();
    const repeat = (): void => {
      step();
      timer = window.setTimeout(repeat, REPEAT_MS);
    };
    timer = window.setTimeout(repeat, REPEAT_DELAY_MS);
  });
  for (const end of ["pointerup", "pointerleave", "pointercancel"]) node.addEventListener(end, stop);
  return node;
}
