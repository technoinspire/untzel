// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { runMenuCommand, type MenuCommandTargets } from "./menu-commands";
import type { MenuCommand } from "./project-menu-model";
function targets() {
  const calls: string[] = [];
  const record = (name: string) => (...args: unknown[]) => void calls.push(args.length === 0 ? name : `${name}(${args.map(String).join(",")})`);
  let previewOn = true;
  const fake: MenuCommandTargets = {
    project: { newProject: record("newProject"), duplicateProject: record("duplicateProject"), deleteProject: record("deleteProject") },
    share: { saveFile: record("saveFile") },
    previewSounds: { isOn: () => previewOn, set: (isOn: boolean) => ((previewOn = isOn), calls.push(`setPreview(${isOn})`)) },
    motion: { toggle: record("toggleMotion") },
    language: { current: () => "en", choose: record("choose") },
    surfaces: {
      openProjects: record("openProjects"),
      openShare: record("openShare"),
      openExport: record("openExport"),
      openShortcuts: record("openShortcuts"),
      openAbout: record("openAbout"),
      pickFile: record("pickFile"),
      renameSong: record("renameSong"),
    },
  };
  return { fake, calls };
}
describe("runMenuCommand", () => {
  it.each([
    ["new-project", "newProject"],
    ["open-project", "openProjects"],
    ["rename-song", "renameSong"],
    ["duplicate", "duplicateProject(null)"],
    ["save-file", "saveFile"],
    ["open-file", "pickFile"],
    ["delete-project", "deleteProject(null)"],
    ["share-link", "openShare"],
    ["export-media", "openExport"],
    ["language-pt-BR", "choose(pt-BR)"],
    ["language-en", "choose(en)"],
    ["reduced-motion", "toggleMotion"],
    ["keyboard-shortcuts", "openShortcuts"],
    ["about", "openAbout"],
  ] as const)("%s calls %s", (command, expected) => {
    const { fake, calls } = targets();
    runMenuCommand(command as MenuCommand, fake);
    expect(calls).toEqual([expected]);
  });
  it("the preview switch calls set once with the opposite value", () => {
    const { fake, calls } = targets();
    runMenuCommand("preview-sounds", fake);
    expect(calls).toEqual(["setPreview(false)"]);
  });
  it("documentation is a link: nothing to call", () => {
    const { fake, calls } = targets();
    runMenuCommand("documentation", fake);
    expect(calls).toEqual([]);
  });
});
