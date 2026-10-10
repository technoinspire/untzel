// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What each menu command does, over injected targets: the project intents,
// the three settings ports and the shell's sheets. Pure, no DOM: it never knows where a
// preference is stored. Documentation is a link and opens by itself.
import type { ShareIntents } from "@untzel/skin-contract";
import type { LanguageChoice } from "./language-choice";
import type { MenuCommand } from "./project-menu-model";
import type { ProjectIntents } from "@untzel/skin-contract";
import type { PreviewSoundsSetting } from "../preferences/preview-sounds-setting";
import type { MotionChoice } from "@untzel/skin-contract";
/** What the shell opens for a command: a sheet, the file picker or the title field. */
export interface MenuSurfaces {
  openProjects(): void;
  openShare(): void;
  openExport(): void;
  openShortcuts(): void;
  openAbout(): void;
  pickFile(): void;
  renameSong(): void;
}
export interface MenuCommandTargets {
  readonly project: Pick<ProjectIntents, "newProject" | "duplicateProject" | "deleteProject">;
  readonly share: Pick<ShareIntents, "saveFile">;
  readonly previewSounds: Pick<PreviewSoundsSetting, "isOn" | "set">;
  readonly motion: Pick<MotionChoice, "toggle">;
  readonly language: LanguageChoice;
  readonly surfaces: MenuSurfaces;
}
export function runMenuCommand(command: MenuCommand, targets: MenuCommandTargets): void {
  const { surfaces } = targets;
  switch (command) {
    case "new-project":
      return targets.project.newProject();
    case "open-project":
      return surfaces.openProjects();
    case "rename-song":
      return surfaces.renameSong();
    case "duplicate":
      return targets.project.duplicateProject(null);
    case "save-file":
      return targets.share.saveFile();
    case "open-file":
      return surfaces.pickFile();
    case "delete-project":
      return targets.project.deleteProject(null);
    case "share-link":
      return surfaces.openShare();
    case "export-media":
      return surfaces.openExport();
    case "language-pt-BR":
      return targets.language.choose("pt-BR");
    case "language-en":
      return targets.language.choose("en");
    case "preview-sounds":
      return targets.previewSounds.set(!targets.previewSounds.isOn());
    case "reduced-motion":
      return targets.motion.toggle();
    case "documentation":
      return;
    case "keyboard-shortcuts":
      return surfaces.openShortcuts();
    case "about":
      return surfaces.openAbout();
  }
}
