// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, setAttributes } from "../dom";
import { icon } from "../icons";
import { text } from "../../copy/copy";
// The one Menu button, last in the top bar: the WAI-ARIA menu button.
// The open state is told by aria-expanded and the visible menu; the flare outline only
// echoes it.
export interface MenuButton {
  readonly root: HTMLButtonElement;
  update(isOpen: boolean): void;
}
/** The button's state attributes; `menuId` is the menu it controls. */
export function menuButtonAttributes(isOpen: boolean, menuId: string): Readonly<Record<string, string>> {
  return { "aria-haspopup": "menu", "aria-expanded": String(isOpen), "aria-controls": menuId };
}
export function createMenuButton(menuId: string, onOpen: (via: "pointer" | "keyboard-first" | "keyboard-last") => void): MenuButton {
  const root = button("ui-topbar__action ui-menu-button", text.menu, (event) => onOpen(event.detail === 0 ? "keyboard-first" : "pointer"), [icon("menu")]);
  root.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    onOpen(event.key === "ArrowDown" ? "keyboard-first" : "keyboard-last");
  });
  const update = (isOpen: boolean): void => setAttributes(root, menuButtonAttributes(isOpen, menuId));
  update(false);
  return { root, update };
}
