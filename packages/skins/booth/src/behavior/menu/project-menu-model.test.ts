// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ProjectView } from "@untzel/presentation/view-model";
import { NO_PROJECT } from "@untzel/presentation/view-model";
import { menuItems, menuSettingsView, popoverColumns, projectMenuModel, type MenuSettingsView } from "./project-menu-model";
const SETTINGS: MenuSettingsView = { locale: "en", isPreviewOn: true, isMotionReduced: false, isMotionFollowingSystem: true };
const OPEN: ProjectView = {
  ...NO_PROJECT,
  title: "Midnight Coast",
  saveState: "saved",
  fileName: "midnight-coast.untzel",
  projects: Array.from({ length: 4 }, (_, index) => ({ id: `p${index}`, title: `P${index}`, edited: "", detail: null, isOpen: index === 0 })),
};
const commands = (groups: ReturnType<typeof projectMenuModel>) => menuItems(groups).map((entry) => entry.command);
describe("projectMenuModel", () => {
  it("keeps the groups in one order, with every item of the menu", () => {
    const groups = projectMenuModel({ phase: "running", project: OPEN }, SETTINGS);
    expect(groups.map((group) => group.label)).toEqual(["Project", "Share and export", "Settings", "Help"]);
    expect(commands(groups)).toEqual([
      "new-project", "open-project", "rename-song", "duplicate", "save-file", "open-file", "delete-project",
      "share-link", "export-media",
      "language-pt-BR", "language-en", "preview-sounds", "reduced-motion",
      "documentation", "keyboard-shortcuts", "about",
    ]);
    const items = menuItems(groups);
    expect(items.find((entry) => entry.command === "open-project")?.hint).toBe("4 on this device");
    expect(items.find((entry) => entry.command === "save-file")?.hint).toBe("midnight-coast.untzel");
    expect(items.find((entry) => entry.command === "delete-project")?.hint).toBe("You can undo for 10 s");
  });
  it("with no project: Project has three items and there is no Share and export", () => {
    const groups = projectMenuModel({ phase: "idle", project: NO_PROJECT }, SETTINGS);
    expect(groups.map((group) => group.id)).toEqual(["project", "settings", "help"]);
    expect(commands(groups).slice(0, 3)).toEqual(["new-project", "open-project", "open-file"]);
    expect(menuItems(groups)[1]?.hint).toBe("0 on this device");
  });
  it("loading and failure read as no project", () => {
    for (const phase of ["loading", "load-failed", "unsupported"] as const) {
      expect(projectMenuModel({ phase, project: OPEN }, SETTINGS).map((group) => group.id), phase).toEqual(["project", "settings", "help"]);
    }
  });
  it("before the first play, Share link and Export are inert and say why", () => {
    const items = menuItems(projectMenuModel({ phase: "idle", project: OPEN }, SETTINGS));
    for (const command of ["share-link", "export-media"] as const) {
      const entry = items.find((candidate) => candidate.command === command);
      expect(entry?.isDisabled, command).toBe(true);
      expect(entry?.hint, command).toBe("Press play first");
    }
  });
  it("blocked storage leaves Duplicate and Delete inert", () => {
    const items = menuItems(projectMenuModel({ phase: "running", project: { ...OPEN, isStorageBlocked: true } }, SETTINGS));
    for (const command of ["duplicate", "delete-project"] as const) {
      expect(items.find((entry) => entry.command === command)).toMatchObject({ isDisabled: true, hint: "Saving is blocked in this browser" });
    }
  });
  it("the switches show their value three ways and keep the menu open", () => {
    const on = menuItems(projectMenuModel({ phase: "running", project: OPEN }, { ...SETTINGS, isMotionReduced: true, isMotionFollowingSystem: false }));
    const motion = on.find((entry) => entry.command === "reduced-motion");
    expect(motion).toMatchObject({ role: "menuitemcheckbox", isChecked: true, switchLabel: "On", hint: "Set on this device", closesMenu: false });
    const preview = on.find((entry) => entry.command === "preview-sounds");
    expect(preview).toMatchObject({ isChecked: true, switchLabel: "On", hint: "Notes play as you edit" });
    const off = menuItems(projectMenuModel({ phase: "running", project: OPEN }, { ...SETTINGS, isPreviewOn: false }));
    expect(off.find((entry) => entry.command === "preview-sounds")).toMatchObject({ isChecked: false, switchLabel: "Off" });
    expect(off.find((entry) => entry.command === "reduced-motion")?.hint).toBe("Follows your system");
  });
  it("the languages are radios in their own language; the docs follow the current one", () => {
    const items = menuItems(projectMenuModel({ phase: "idle", project: NO_PROJECT }, { ...SETTINGS, locale: "pt-BR" }));
    const radios = items.filter((entry) => entry.role === "menuitemradio");
    expect(radios.map((entry) => [entry.label, entry.lang, entry.isChecked])).toEqual([
      ["Português", "pt-BR", true],
      ["English", "en", false],
    ]);
    expect(items.find((entry) => entry.command === "documentation")?.href).toBe("/untzel/docs/");
    const english = menuItems(projectMenuModel({ phase: "idle", project: NO_PROJECT }, SETTINGS));
    expect(english.find((entry) => entry.command === "documentation")?.href).toBe("/untzel/docs/en/");
  });
});
describe("popoverColumns", () => {
  it("with a project: Project | Share and export, Settings, Help", () => {
    const [left, right] = popoverColumns(projectMenuModel({ phase: "running", project: OPEN }, SETTINGS));
    expect([left.map((group) => group.id), right.map((group) => group.id)]).toEqual([["project"], ["share", "settings", "help"]]);
  });
  it("without one: Project, Settings | Help, in the same order", () => {
    const [left, right] = popoverColumns(projectMenuModel({ phase: "idle", project: NO_PROJECT }, SETTINGS));
    expect([left.map((group) => group.id), right.map((group) => group.id)]).toEqual([["project", "settings"], ["help"]]);
  });
});
describe("menuSettingsView", () => {
  it("reads the three ports", () => {
    const view = menuSettingsView({ current: () => "pt-BR" }, { isOn: () => false }, { isReduced: () => true, isFollowingSystem: () => false });
    expect(view).toEqual({ locale: "pt-BR", isPreviewOn: false, isMotionReduced: true, isMotionFollowingSystem: false });
  });
});
