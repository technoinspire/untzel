// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element, setText } from "../dom";
import { icon } from "../icons";
import type { UntzelView } from "@untzel/presentation/view-model";
import { projectMenuModel, type MenuItemModel, type MenuSettingsView } from "../../behavior/menu/project-menu-model";
import { strings, text } from "../../copy/copy";
import { createMenuPopover } from "./menu-popover";
import { createProjectMenu, type MenuCloseReason } from "./project-menu";
import { createSheet } from "../sheets/sheet";
// Where the project menu shows: a bottom sheet under 1200 px, whose header
// repeats the title and the save state the phone's bar has no room for, and a popover
// from 1200 px. The shell decides isDesktop and whether it is open on every render; the
// host subscribes to nothing and reads no port. It redraws the open menu in the same
// element, so a switch or the language keeps the focus on its item.
export type MenuHostClose = MenuCloseReason;
export interface ProjectMenuHostOptions {
  readonly id: string;
  readonly anchor: () => HTMLElement;
  readonly onCommand: (item: MenuItemModel) => void;
  readonly onClose: (reason: MenuHostClose) => void;
}
export interface ProjectMenuHost {
  /** The sheet and the popover, both outside the side panel. */
  readonly nodes: readonly HTMLElement[];
  /** The bottom sheet under 1200 px, the layer the shell's modal guard marks. */
  readonly sheet: HTMLElement;
  update(view: UntzelView, settings: MenuSettingsView, isDesktop: boolean, isOpen: boolean): void;
  focusAt(position: "first" | "last"): void;
}
/** The sheet's heading: the song title, or "Menu" with no project open. */
export function menuSheetHeading(title: string | null): string {
  return title ?? strings.menu;
}
export function createProjectMenuHost(options: ProjectMenuHostOptions): ProjectMenuHost {
  const menu = createProjectMenu({ id: options.id, onCommand: options.onCommand, onClose: options.onClose });
  const sheet = createSheet({ id: `${options.id}-sheet`, title: text.menu, className: "ui-sheet--menu", onClose: () => options.onClose("escape") });
  const statusText = element("span");
  const status = element("p", { className: "ui-menu-sheet__status" }, [icon("check"), statusText]);
  sheet.heading.after(status);
  const popover = createMenuPopover(element("div", { className: "ui-menu-popover__slot" }));
  const slot = popover.root.firstElementChild as HTMLElement;
  return {
    nodes: [sheet.root, popover.root],
    sheet: sheet.root,
    update(view, settings, isDesktop, isOpen) {
      sheet.root.hidden = !isOpen || isDesktop;
      if (!isOpen) {
        popover.close();
        return;
      }
      const host = isDesktop ? slot : sheet.body;
      if (menu.root.parentElement !== host) host.append(menu.root);
      menu.update(projectMenuModel({ phase: view.phase, project: view.project }, settings), isDesktop);
      setText(sheet.heading, menuSheetHeading(view.project.title));
      setText(statusText, view.project.saveState === "saved" ? strings.savedOnDevice : "");
      status.hidden = view.project.saveState !== "saved";
      if (isDesktop) popover.open(options.anchor());
      else popover.close();
    },
    focusAt: (position) => menu.focusAt(position),
  };
}
