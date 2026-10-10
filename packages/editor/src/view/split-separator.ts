// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { text } from "../copy/copy";
import { el, labelAttribute } from "../terminal/dom";

// The divider between the code and the open command line: a focusable separator, the
// arrows move it 24 px, a drag moves it freely, within 160 px and 70 % of the area.

export const SPLIT_STEP_PX = 24;
export const SPLIT_MIN_PX = 160;
export const SPLIT_MAX_RATIO = 0.7;
const SPLIT_DEFAULT_RATIO = 0.45;

/** The command line's height for a wanted one, inside the limits of an area this tall. */
export function clampSplit(height: number, total: number): number {
  return Math.round(Math.min(Math.max(height, SPLIT_MIN_PX), Math.max(SPLIT_MIN_PX, total * SPLIT_MAX_RATIO)));
}

/** The height goes to the area as --ut-terminal-h; CSS lays the rows out. */
// Over 40 lines: one separator and its drag; the keys and the pointer share the height.
export function createSplitSeparator(area: HTMLElement): HTMLElement {
  const separator = el("div", "ut-split");
  separator.tabIndex = 0;
  for (const [name, value] of Object.entries({
    role: "separator",
    "aria-orientation": "horizontal",
    "aria-valuemin": "0",
    "aria-valuemax": String(Math.round(SPLIT_MAX_RATIO * 100)),
    "aria-valuenow": String(Math.round(SPLIT_DEFAULT_RATIO * 100)),
  })) {
    separator.setAttribute(name, value);
  }
  labelAttribute(separator, "aria-label", text.resize);
  let height: number | null = null;
  const set = (wanted: number): void => {
    const total = area.getBoundingClientRect().height;
    height = clampSplit(wanted, total);
    area.style.setProperty("--ut-terminal-h", `${height}px`);
    separator.setAttribute("aria-valuenow", String(Math.round((height / Math.max(1, total)) * 100)));
  };
  // Before the first move the stylesheet's default holds (45 %, or most of the area on a
  // phone): the arrows start from the height drawn, not from a ratio of their own.
  const drawn = (): number => separator.nextElementSibling?.getBoundingClientRect().height ?? area.getBoundingClientRect().height * SPLIT_DEFAULT_RATIO;
  const current = (): number => height ?? drawn();
  separator.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    set(current() + (event.key === "ArrowUp" ? SPLIT_STEP_PX : -SPLIT_STEP_PX));
  });
  separator.addEventListener("pointerdown", (event) => {
    separator.setPointerCapture(event.pointerId);
    const move = (moved: PointerEvent): void => set(area.getBoundingClientRect().bottom - moved.clientY);
    const up = (): void => {
      separator.removeEventListener("pointermove", move);
      separator.removeEventListener("pointerup", up);
    };
    separator.addEventListener("pointermove", move);
    separator.addEventListener("pointerup", up);
  });
  return separator;
}
