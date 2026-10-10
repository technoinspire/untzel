// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setAttributes, setText } from "../dom";
import { icon } from "../icons";

// One chip says how long something lasts: the
// loop in the transport, a pattern in the track detail, a part in its editor. It opens
// the length picker; its labels come from format.ts.

export interface LengthChip {
  readonly root: HTMLButtonElement;
  /** `label` is visible ("Length 4 bars"); `name` is the accessible name. */
  update(label: string, name: string, isOpen: boolean): void;
}

export function createLengthChip(className: string, onOpen: () => void): LengthChip {
  const text = element("span", { className: "ui-chip-length__label" });
  const root = button(`ui-chip-length ${className}`, "", onOpen, [text, icon("chevron")]);
  setAttributes(root, { "aria-haspopup": "dialog", "aria-expanded": "false" });
  return {
    root,
    update(label, name, isOpen) {
      setText(text, label);
      root.setAttribute("aria-label", name);
      root.setAttribute("aria-expanded", String(isOpen));
    },
  };
}
