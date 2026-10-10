// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element, setVar } from "../dom";
import { menuPopoverPosition } from "./menu-popover-position";

// The desktop container of the project menu: 640 px wide, anchored to the
// Menu button by menuPopoverPosition. A click outside lands on the shell's transparent
// backdrop, which closes it without reaching what is under it; Esc and choosing a command
// close through the menu itself. Not modal: the music and the page stay live.

export interface MenuPopover {
  readonly root: HTMLElement;
  /** Shows the menu under (or above) the button. */
  open(anchor: HTMLElement): void;
  close(): void;
}

export function createMenuPopover(menu: HTMLElement): MenuPopover {
  const root = element("div", { className: "ui-menu-popover", attributes: { hidden: true } }, [menu]);
  return {
    root,
    open(anchor) {
      root.hidden = false;
      const box = anchor.getBoundingClientRect();
      const at = menuPopoverPosition(box, { width: root.offsetWidth, height: root.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
      setVar(root, "--menu-left", `${at.left}px`);
      setVar(root, "--menu-top", `${at.top}px`);
    },
    close() {
      root.hidden = true;
    },
  };
}
