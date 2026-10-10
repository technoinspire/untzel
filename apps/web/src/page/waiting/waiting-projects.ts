// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project intents before and after the tap: the library lives in the engine's
// chunk, so each intent waits for it; Continue is the tap itself. Part of the initial JS.
import type { ProjectIntents } from "@untzel/skin-contract";
import type { App } from "../../boot";
import type { StartSource } from "../deferred-controls-port";

export function waitingProjects(app: () => Promise<App>, start: (source: StartSource) => void): ProjectIntents {
  const withProjects = (run: (projects: ProjectIntents) => void): void => void app().then((loaded) => run(loaded.projects));
  return {
    newProject: () => withProjects((library) => library.newProject()),
    openProject: (id) => withProjects((library) => library.openProject(id)),
    // Inside the tap: the sound unlocks now, the project's text is read by the engine.
    continueProject: (id) => start({ kind: "project", id }),
    renameSong: (title) => withProjects((library) => library.renameSong(title)),
    renameProject: (id, title) => withProjects((library) => library.renameProject(id, title)),
    duplicateProject: (id) => withProjects((library) => library.duplicateProject(id)),
    deleteProject: (id) => withProjects((library) => library.deleteProject(id)),
    undoDeleteProject: () => withProjects((library) => library.undoDeleteProject()),
    saveProjectFile: (id) => withProjects((library) => library.saveProjectFile(id)),
    saveProjectNow: () => withProjects((library) => library.saveProjectNow()),
  };
}

/** Save file with no music running: the open project, as stored. */
export function saveWaitingFile(app: Promise<App>): void {
  void app.then((loaded) => {
    const open = loaded.projects.view().projects.find((project) => project.isOpen);
    if (open !== undefined) loaded.projects.saveProjectFile(open.id);
  });
}
