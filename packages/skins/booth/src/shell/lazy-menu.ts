// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project menu and its three sheets load after the first paint (the budget of the
// initial JS up to the waiting stage): the waiting stage paints without them, the page fetches
// them right after, and the Menu button waits for them only if it is pressed first. Two slots
// hold their places in the shell from the start: one beside the other floating layers,
// one in the side panel. Both are `display: contents`, so the sheets lay out as if they
// were the slots' parents' own children.
import { element } from "../views/dom";
import type { MenuSurfacesOptions, MenuSurfacesShell } from "../behavior/menu/menu-surfaces";

export interface LazyMenu {
  /** Where the menu's sheet and popover go, among the shell's floating layers. */
  readonly floatingSlot: HTMLElement;
  /** Where Projects, Keyboard shortcuts and About go, in the side panel. */
  readonly panelSlot: HTMLElement;
  /** The surfaces once loaded; null before. */
  current(): MenuSurfacesShell | null;
  /** Loads once; every later call gets the same surfaces. */
  load(): Promise<MenuSurfacesShell>;
}

export function createLazyMenu(options: MenuSurfacesOptions, onLoaded: () => void): LazyMenu {
  const floatingSlot = element("div", { className: "ui-slot" });
  const panelSlot = element("div", { className: "ui-slot" });
  let surfaces: MenuSurfacesShell | null = null;
  let loading: Promise<MenuSurfacesShell> | null = null;
  return {
    floatingSlot,
    panelSlot,
    current: () => surfaces,
    load() {
      loading ??= import("../behavior/menu/menu-surfaces").then(({ createMenuSurfaces }) => {
        const created = createMenuSurfaces(options);
        floatingSlot.append(...created.floating);
        panelSlot.append(created.sheets.projects.root, created.sheets.shortcuts.root, created.sheets.about.root);
        surfaces = created;
        onLoaded();
        return created;
      });
      return loading;
    },
  };
}
