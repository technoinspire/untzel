// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project menu's content: groups in one fixed order, each item
// with its state and why it is inert. Pure: the view draws it, the keyboard walks the
// flattened list, and the popover only cuts the same list into two columns.
import type { IconName } from "../../views/icons";
import { languageOptions, type MenuLocale } from "./language-choice";
import type { AppPhase, ProjectView } from "@untzel/presentation/view-model";
import { phrases, strings } from "../../copy/copy";
export type MenuCommand =
  | "new-project"
  | "open-project"
  | "rename-song"
  | "duplicate"
  | "save-file"
  | "open-file"
  | "delete-project"
  | "share-link"
  | "export-media"
  | "language-pt-BR"
  | "language-en"
  | "preview-sounds"
  | "reduced-motion"
  | "documentation"
  | "keyboard-shortcuts"
  | "about";
export type MenuItemRole = "menuitem" | "menuitemcheckbox" | "menuitemradio";
export interface MenuItemModel {
  readonly command: MenuCommand;
  readonly role: MenuItemRole;
  readonly label: string;
  readonly hint: string | null;
  readonly icon: IconName | null;
  /** Inert but focusable (aria-disabled); the hint says why. */
  readonly isDisabled: boolean;
  /** aria-checked of a checkbox or a radio; null for a command. */
  readonly isChecked: boolean | null;
  /** "On" or "Off" beside a switch; null otherwise. */
  readonly switchLabel: string | null;
  /** The radio's own language (lang). */
  readonly lang: string | null;
  /** A link item (Documentation) opens in a new tab. */
  readonly href: string | null;
  /** The switches and the language keep the menu open; commands close it. */
  readonly closesMenu: boolean;
  readonly isDanger: boolean;
}
export interface MenuSectionModel {
  /** A nested group's name (Language); null for the group's plain items. */
  readonly label: string | null;
  readonly items: readonly MenuItemModel[];
}
export type MenuGroupId = "project" | "share" | "settings" | "help";
export interface MenuGroupModel {
  readonly id: MenuGroupId;
  readonly label: string;
  readonly sections: readonly MenuSectionModel[];
}
/** The settings the menu shows, read by the shell from the three ports. */
export interface MenuSettingsView {
  readonly locale: MenuLocale;
  readonly isPreviewOn: boolean;
  readonly isMotionReduced: boolean;
  readonly isMotionFollowingSystem: boolean;
}
export interface MenuContext {
  readonly phase: AppPhase;
  readonly project: ProjectView;
}
export function menuSettingsView(
  language: { current(): MenuLocale },
  previewSounds: { isOn(): boolean },
  motion: { isReduced(): boolean; isFollowingSystem(): boolean },
): MenuSettingsView {
  return {
    locale: language.current(),
    isPreviewOn: previewSounds.isOn(),
    isMotionReduced: motion.isReduced(),
    isMotionFollowingSystem: motion.isFollowingSystem(),
  };
}
/** Loading and failure read as "no project": the language and the help still serve there. */
function isProjectOpen(context: MenuContext): boolean {
  return (context.phase === "idle" || context.phase === "running") && context.project.title !== null;
}
const DOCS_URL: Readonly<Record<MenuLocale, string>> = { "pt-BR": "/untzel/docs/", en: "/untzel/docs/en/" };
type ItemFields = Pick<MenuItemModel, "command" | "label"> & Partial<MenuItemModel>;
function item(fields: ItemFields): MenuItemModel {
  return {
    role: "menuitem",
    hint: null,
    icon: null,
    isDisabled: false,
    isChecked: null,
    switchLabel: null,
    lang: null,
    href: null,
    closesMenu: true,
    isDanger: false,
    ...fields,
  };
}
/** Inert with its reason in the hint, or active with its usual hint. */
function inertWhen(isInert: boolean, reason: string, hint: string | null): Pick<MenuItemModel, "isDisabled" | "hint"> {
  return isInert ? { isDisabled: true, hint: reason } : { isDisabled: false, hint };
}
function projectGroup(context: MenuContext): MenuGroupModel {
  const { project } = context;
  const hasProject = isProjectOpen(context);
  const count = phrases.projectsOnDevice(project.projects.length);
  const blocked = project.isStorageBlocked;
  const items = [
    item({ command: "new-project", label: strings.newProject, hint: strings.newProjectHint, icon: "plus" }),
    item({ command: "open-project", label: strings.openProject, hint: count, icon: "folder" }),
    ...(hasProject
      ? [
          item({ command: "rename-song", label: strings.renameSong, icon: "pencil" }),
          item({ command: "duplicate", label: strings.duplicate, icon: "duplicate", ...inertWhen(blocked, strings.savingBlocked, null) }),
          item({ command: "save-file", label: strings.saveFile, hint: project.fileName, icon: "save-file" }),
        ]
      : []),
    item({ command: "open-file", label: strings.openFileMenu, icon: "open-file" }),
    ...(hasProject
      ? [item({ command: "delete-project", label: strings.deleteProject, icon: "trash", isDanger: true, ...inertWhen(blocked, strings.savingBlocked, strings.deleteUndoHint) })]
      : []),
  ];
  return { id: "project", label: strings.menuProject, sections: [{ label: null, items }] };
}
function shareGroup(context: MenuContext): MenuGroupModel {
  const isInert = context.phase !== "running";
  const items = [
    item({ command: "share-link", label: strings.shareLinkMenu, icon: "link", ...inertWhen(isInert, strings.pressPlayFirst, null) }),
    item({ command: "export-media", label: strings.exportMedia, icon: "export", ...inertWhen(isInert, strings.pressPlayFirst, null) }),
  ];
  return { id: "share", label: strings.menuShareExport, sections: [{ label: null, items }] };
}
function toggle(command: MenuCommand, label: string, hint: string, icon: IconName, isOn: boolean): MenuItemModel {
  return item({ command, label, hint, icon, role: "menuitemcheckbox", isChecked: isOn, switchLabel: isOn ? strings.switchOn : strings.switchOff, closesMenu: false });
}
function settingsGroup(settings: MenuSettingsView): MenuGroupModel {
  const languages = languageOptions(settings.locale).map((option) =>
    item({ command: `language-${option.locale}`, label: option.label, role: "menuitemradio", isChecked: option.isCurrent, lang: option.lang, closesMenu: false }),
  );
  const motionHint = settings.isMotionFollowingSystem ? strings.followsSystem : strings.setOnDevice;
  return {
    id: "settings",
    label: strings.menuSettings,
    sections: [
      { label: strings.language, items: languages },
      {
        label: null,
        items: [
          toggle("preview-sounds", strings.previewSounds, strings.previewSoundsHint, "speaker", settings.isPreviewOn),
          toggle("reduced-motion", strings.reducedMotion, motionHint, "motion", settings.isMotionReduced),
        ],
      },
    ],
  };
}
function helpGroup(settings: MenuSettingsView): MenuGroupModel {
  const items = [
    item({ command: "documentation", label: strings.documentation, hint: strings.opensNewTab, icon: "book", href: DOCS_URL[settings.locale] }),
    item({ command: "keyboard-shortcuts", label: strings.keyboardShortcuts, icon: "keyboard" }),
    item({ command: "about", label: strings.aboutLicence, icon: "info" }),
  ];
  return { id: "help", label: strings.menuHelp, sections: [{ label: null, items }] };
}
/** Project, Share and export, Settings, Help, in every state; no Share and export without a project. */
export function projectMenuModel(context: MenuContext, settings: MenuSettingsView): readonly MenuGroupModel[] {
  const hasProject = isProjectOpen(context);
  return [projectGroup(context), ...(hasProject ? [shareGroup(context)] : []), settingsGroup(settings), helpGroup(settings)];
}
/** Every item in reading order: what the arrow keys walk, whatever the columns. */
export function menuItems(groups: readonly MenuGroupModel[]): readonly MenuItemModel[] {
  return groups.flatMap((group) => group.sections.flatMap((section) => section.items));
}
/**
 * The popover's two columns cut the fixed order in two, never reordering: the second
 * column starts with the first group that leaves the project (Share and export, else
 * Help). With a project, Project | Share and export, Settings, Help; without one,
 * Project, Settings | Help (b-menu-1440 and b-idle-1440).
 */
export function popoverColumns(groups: readonly MenuGroupModel[]): readonly [readonly MenuGroupModel[], readonly MenuGroupModel[]] {
  const split = groups.findIndex((group) => group.id === "share" || group.id === "help");
  const at = split === -1 ? groups.length : split;
  return [groups.slice(0, at), groups.slice(at)];
}
