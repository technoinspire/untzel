// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element, setAttributes } from "../dom";
import { icon } from "../icons";
import { menuKey } from "../../behavior/keyboard/menu-keyboard";
import { menuItems, popoverColumns, type MenuCommand, type MenuGroupModel, type MenuItemModel } from "../../behavior/menu/project-menu-model";
import { strings, text } from "../../copy/copy";
// The project menu's list: role="menu", one role="group" per group named
// by its label paragraph (not a heading), Language as a nested group of two radios.
// Roving focus over the flattened list; the popover cuts it in two columns, the sheet
// shows one. Dumb: it draws the model and emits the command or why it should close.
export type MenuCloseReason = "escape" | "tab";
export interface ProjectMenuOptions {
  readonly id: string;
  readonly onCommand: (item: MenuItemModel) => void;
  readonly onClose: (reason: MenuCloseReason) => void;
}
export interface ProjectMenu {
  readonly root: HTMLElement;
  /** Redraws in the same element; the focus stays on the item of the same command. */
  update(groups: readonly MenuGroupModel[], isTwoColumns: boolean): void;
  focusAt(position: "first" | "last"): void;
  /** The item focused now, to come back to after a redraw. */
  focusedCommand(): MenuCommand | null;
}
// Over 40 lines: one menu built and updated; its commands come from project-menu-model.ts.
export function createProjectMenu(options: ProjectMenuOptions): ProjectMenu {
  const root = element("div", { className: "ui-menu", attributes: { id: options.id, role: "menu", "aria-label": text.menu } });
  let items: readonly MenuItemModel[] = [];
  let nodes: HTMLElement[] = [];
  /** The model last drawn: the shell renders on every playhead move, the menu only on a change. */
  let drawn = "";
  const focusIndex = (index: number): void => nodes[index]?.focus({ preventScroll: false });
  root.addEventListener("keydown", (event) => {
    const current = nodes.findIndex((node) => node === document.activeElement);
    if (event.key === " " && current !== -1) {
      event.preventDefault();
      nodes[current]?.click();
      return;
    }
    const result = menuKey(event.key, Math.max(current, 0), items.map((entry) => entry.label));
    if (result.kind === "none") return;
    if (result.kind !== "leave") event.preventDefault();
    // Esc closes the menu alone, not the layer under it too.
    if (result.kind === "close") event.stopPropagation();
    if (result.kind === "focus") focusIndex(result.index);
    else options.onClose(result.kind === "close" ? "escape" : "tab");
  });
  const activate = (entry: MenuItemModel, event: Event): void => {
    if (entry.isDisabled) {
      event.preventDefault();
      return;
    }
    options.onCommand(entry);
  };
  return {
    root,
    update(groups, isTwoColumns) {
      const key = JSON.stringify([groups, isTwoColumns]);
      if (key === drawn) return;
      drawn = key;
      const refocus = root.contains(document.activeElement) ? this.focusedCommand() : null;
      items = menuItems(groups);
      const columns = isTwoColumns ? popoverColumns(groups) : [groups];
      root.dataset["columns"] = String(columns.length);
      root.replaceChildren(...columns.map((column) => element("div", { className: "ui-menu__column" }, column.map((group) => groupNode(options.id, group)))));
      nodes = items.map((entry) => {
        const node = root.querySelector<HTMLElement>(`[data-command="${entry.command}"]`);
        if (node === null) throw new Error(`menu: no node for ${entry.command}`);
        node.addEventListener("click", (event) => activate(entry, event));
        return node;
      });
      if (refocus !== null) nodes[items.findIndex((entry) => entry.command === refocus)]?.focus({ preventScroll: true });
    },
    focusAt(position) {
      focusIndex(position === "first" ? 0 : nodes.length - 1);
    },
    focusedCommand() {
      const index = nodes.findIndex((node) => node === document.activeElement);
      return items[index]?.command ?? null;
    },
  };
}
function groupNode(menuId: string, group: MenuGroupModel): HTMLElement {
  const labelId = `${menuId}-${group.id}`;
  const label = element("p", { className: "ui-menu__group-label", text: group.label, attributes: { id: labelId } });
  const sections = group.sections.map((section) =>
    section.label === null
      ? section.items.map(itemNode)
      : [element("div", { className: "ui-menu__subgroup", attributes: { role: "group", "aria-label": section.label } }, [
          element("p", { className: "ui-menu__subgroup-label", attributes: { "aria-hidden": "true" } }, [
            element("span", { className: "ui-menu__icon" }, [icon("globe")]),
            element("span", { text: section.label }),
          ]),
          element("div", { className: "ui-menu__segmented" }, section.items.map(itemNode)),
        ])],
  );
  return element("div", { className: "ui-menu__group", attributes: { role: "group", "aria-labelledby": labelId } }, [label, ...sections.flat()]);
}
function itemNode(entry: MenuItemModel): HTMLElement {
  const text = element("span", { className: "ui-menu__text" }, [
    element("span", { className: "ui-menu__label", text: entry.label }),
    ...(entry.hint === null ? [] : [element("span", { className: "ui-menu__hint", text: entry.hint })]),
  ]);
  const lead = entry.icon === null ? element("span", { className: "ui-menu__icon" }) : element("span", { className: "ui-menu__icon" }, [icon(entry.icon)]);
  const trail = trailing(entry);
  const node = entry.href === null ? element("button", { attributes: { type: "button" } }) : element("a", { attributes: { href: entry.href, target: "_blank", rel: "noopener" } });
  node.className = menuItemClass(entry);
  node.append(lead, text, ...(trail === null ? [] : [trail]));
  setAttributes(node, {
    role: entry.role,
    tabindex: -1,
    "data-command": entry.command,
    "aria-disabled": entry.isDisabled ? "true" : null,
    "aria-checked": entry.isChecked === null ? null : String(entry.isChecked),
    lang: entry.lang,
  });
  return node;
}
/** Rows of 48 px, 56 with a hint; Delete's icon in ember. */
export function menuItemClass(entry: Pick<MenuItemModel, "hint" | "isDanger">): string {
  return `ui-menu__item${entry.hint === null ? "" : " ui-menu__item--tall"}${entry.isDanger ? " ui-menu__item--danger" : ""}`;
}
/** What ends the row: a switch with On or Off, the chosen language's check, or the new-tab arrow. */
export function trailingKind(entry: Pick<MenuItemModel, "switchLabel" | "role" | "href">): "switch" | "check" | "external" | null {
  if (entry.switchLabel !== null) return "switch";
  if (entry.role === "menuitemradio") return "check";
  return entry.href === null ? null : "external";
}
function trailing(entry: MenuItemModel): HTMLElement | null {
  const hidden = { "aria-hidden": "true" };
  switch (trailingKind(entry)) {
    case "switch":
      return element("span", { className: "ui-menu__switch", attributes: hidden }, [
        element("span", { className: "ui-menu__switch-text", text: entry.switchLabel ?? "" }),
        element("span", { className: "ui-switch__track" }),
      ]);
    case "check":
      return element("span", { className: "ui-menu__check", attributes: hidden }, entry.isChecked === true ? [icon("check")] : []);
    case "external":
      return element("span", { className: "ui-menu__external", attributes: hidden }, [icon("external")]);
    case null:
      return null;
  }
}
