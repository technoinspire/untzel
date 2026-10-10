// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The shell's part for the project menu: the menu host and the three sheets it
// opens (Projects, Keyboard shortcuts, About), the commands, and the toast of a deleted
// project with its 10 s Undo. Wiring only: the rules live in the models and the ports.
import type { ControlsPort } from "@untzel/skin-contract";
import type { LanguageChoice } from "./language-choice";
import { runMenuCommand, type MenuSurfaces } from "./menu-commands";
import type { UntzelView } from "@untzel/presentation/view-model";
import type { Overlay, ShownLayers, UiState } from "../../shell/navigation";
import type { PreviewSoundsSetting } from "../preferences/preview-sounds-setting";
import { menuSettingsView, type MenuItemModel } from "./project-menu-model";
import type { MotionChoice } from "@untzel/skin-contract";
import { phrases, text } from "../../copy/copy";
import { createAboutSheet } from "../../views/menu/about-sheet";
import { createProjectMenuHost, type MenuHostClose } from "../../views/menu/project-menu-host";
import { createProjectsSheet } from "../../views/menu/projects-sheet";
import { createShortcutsSheet } from "../../views/menu/shortcuts-sheet";
import type { Sheet } from "../../views/sheets/sheet";
import { PROJECT_TOAST_MS, TOAST_MS, type Toast } from "../../views/frame/toast";
export interface MenuSurfacesOptions {
  readonly port: ControlsPort;
  readonly menuId: string;
  readonly version: string;
  readonly isMac: boolean;
  readonly toast: Toast;
  readonly previewSounds: PreviewSoundsSetting;
  readonly motion: MotionChoice;
  readonly language: LanguageChoice;
  readonly anchor: () => HTMLElement;
  readonly announce: (message: string) => void;
  readonly navigate: (next: Partial<UiState>) => void;
  /** Closes the top layer and gives the focus back to what opened it. */
  readonly dismiss: () => boolean;
  /** The project menu's other doors: the file picker and the title field. */
  readonly pickFile: () => void;
  readonly renameSong: () => void;
}
export interface MenuSurfacesShell {
  /** The menu's sheet and popover, outside the side panel. */
  readonly floating: readonly HTMLElement[];
  /** The menu's bottom sheet under 1200 px. */
  readonly menuSheet: HTMLElement;
  /** Projects, Keyboard shortcuts and About: side panel sheets on the desktop. */
  readonly sheets: Readonly<Record<"projects" | "shortcuts" | "about", Sheet>>;
  update(view: UntzelView, shown: ShownLayers, isDesktop: boolean): void;
  focusMenu(position: "first" | "last"): void;
}
/** The title of the project a delete is about, for the toast. */
export function deletedTitle(view: UntzelView, id: string | null): string {
  if (id === null) return view.project.title ?? "";
  return view.project.projects.find((project) => project.id === id)?.title ?? "";
}
// Over 40 lines: the menu, its sheets and its commands built together; update and the commands share them.
export function createMenuSurfaces(options: MenuSurfacesOptions): MenuSurfacesShell {
  const { port } = options;
  const close = (): void => void options.dismiss();
  const open = (overlay: Overlay) => (): void => options.navigate({ overlay });
  const deleteProject = (id: string | null): void => {
    const title = deletedTitle(port.view(), id);
    port.deleteProject(id);
    options.toast.show(() => phrases.projectDeleted(title), text.undo, () => {
      port.undoDeleteProject();
      options.toast.note(() => phrases.projectRestored(title), TOAST_MS);
    }, PROJECT_TOAST_MS);
  };
  const intents = { ...pick(port), deleteProject };
  const surfaces: MenuSurfaces = {
    openProjects: open("projects"),
    openShare: open("share"),
    openExport: open("export"),
    openShortcuts: open("shortcuts"),
    openAbout: open("about"),
    pickFile: options.pickFile,
    renameSong: options.renameSong,
  };
  const onCommand = (item: MenuItemModel): void => {
    const opensSheet = ["open-project", "share-link", "export-media", "keyboard-shortcuts", "about"].includes(item.command);
    if (item.closesMenu && !opensSheet) close();
    runMenuCommand(item.command, { project: intents, share: port, previewSounds: options.previewSounds, motion: options.motion, language: options.language, surfaces });
  };
  const onClose = (reason: MenuHostClose): void => {
    if (reason !== "tab") return close();
    // The menu button pattern: the browser's own Tab step goes on from the
    // Menu button, so the focus moves there before the menu and its inert page go.
    options.anchor().focus({ preventScroll: true });
    options.navigate({ overlay: null });
  };
  const host = createProjectMenuHost({ id: options.menuId, anchor: options.anchor, onCommand, onClose });
  const projects = createProjectsSheet({ ...pick(port), deleteProject }, options.announce, close);
  const shortcuts = createShortcutsSheet(options.isMac, close);
  const about = createAboutSheet({ version: options.version }, close);
  return {
    floating: host.nodes,
    menuSheet: host.sheet,
    sheets: { projects, shortcuts, about },
    update(view, shown, isDesktop) {
      host.update(view, menuSettingsView(options.language, options.previewSounds, options.motion), isDesktop, shown.menu);
      projects.update(view);
      projects.root.hidden = !shown.projects;
      shortcuts.root.hidden = !shown.shortcuts;
      about.update(shown.about);
    },
    focusMenu: (position) => host.focusAt(position),
  };
}
/** The project intents the menu and the Projects sheet use, bound to the port. */
function pick(port: ControlsPort) {
  return {
    newProject: () => port.newProject(),
    openProject: (id: string) => port.openProject(id),
    renameProject: (id: string, title: string) => port.renameProject(id, title),
    duplicateProject: (id: string | null) => port.duplicateProject(id),
    deleteProject: (id: string | null) => port.deleteProject(id),
    saveProjectFile: (id: string) => port.saveProjectFile(id),
  };
}
