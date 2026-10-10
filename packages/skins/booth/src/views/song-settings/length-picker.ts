// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { phrases } from "../../copy/copy";
import { button, element, setPressed, setText, setVar } from "../dom";
import { barsLabel } from "../../behavior/text/format";
import { MUSICAL_LENGTHS } from "../../behavior/text/lengths";
import type { LengthChoice } from "./length-choices";
import { popoverPosition } from "../primitives/popover-position";
import { nextKeyIndex } from "../primitives/roving-keys";
import { createSheet, type Sheet } from "../sheets/sheet";

// The picker of musical lengths a Length chip opens:
// 1, 2, 4, 8 and 16 bars, the length written in the text in flare. On the
// phone a bottom sheet; on the desktop a popover by the chip. Both close by ×, Esc and a
// tap outside; the sheet also by dragging it down. Its texts come from length-choices.ts.

export interface LengthPicker extends Sheet {
  update(choice: LengthChoice | null): void;
  /** Desktop: places the popover under (or above) the chip that opened it. */
  anchor(rect: DOMRect | null): void;
}

// Over 40 lines: one picker built, updated and anchored, nothing else.
export function createLengthPicker(onClose: () => void): LengthPicker {
  const sheet = createSheet({ id: "ui-length", title: "", className: "ui-sheet--length", onClose });
  const note = element("p", { className: "ui-sheet__hint ui-length__note" });
  // An odd length written in the code lights none of the five: this line says it.
  const written = element("p", { className: "ui-length__written" });
  let choice: LengthChoice | null = null;
  const options = MUSICAL_LENGTHS.map((bars) => {
    const node = button("ui-length__option", () => barsLabel(bars), () => choice?.pick(bars), [
      element("span", { className: "ui-length__number", text: String(bars), attributes: { "aria-hidden": "true" } }),
      element("span", { className: "ui-length__unit", text: () => phrases.barUnit(bars), attributes: { "aria-hidden": "true" } }),
    ]);
    node.dataset["bars"] = String(bars);
    return node;
  });
  const group = element("div", { className: "ui-length__options", attributes: { role: "group" } }, options);
  const other = element("p", { className: "ui-sheet__hint ui-length__other" });
  sheet.body.append(note, written, group, other);

  // Arrow keys move between the five lengths; Enter or Space picks one.
  group.addEventListener("keydown", (event) => {
    const index = nextKeyIndex(options.indexOf(event.target as HTMLButtonElement), event.key, options.length);
    if (index === null) return;
    event.preventDefault();
    options[index]?.focus();
  });

  return {
    ...sheet,
    update(next) {
      choice = next;
      if (next === null) return;
      setText(sheet.heading, next.title);
      setText(note, next.note);
      setText(written, next.written ?? "");
      written.hidden = next.written === null;
      setText(other, next.other);
      group.setAttribute("aria-label", next.title);
      options.forEach((option) => setPressed(option, Number(option.dataset["bars"]) === next.current));
    },
    anchor(rect) {
      if (rect === null) return;
      const popover = { width: sheet.root.offsetWidth, height: sheet.root.offsetHeight };
      const { left, top } = popoverPosition(rect, popover, { width: window.innerWidth, height: window.innerHeight });
      setVar(sheet.root, "--anchor-left", `${left}px`);
      setVar(sheet.root, "--anchor-top", `${top}px`);
    },
  };
}
