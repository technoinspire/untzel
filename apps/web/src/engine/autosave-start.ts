// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The open project's autosave, started again at every tap. Part of the boot chunk.
import type { ProjectControls } from "../adapters/project-controls";
import { createAutosave, type Autosave } from "../page/autosave";
import type { Running } from "./engine-assembly";

/** Saves the open project 1 s after a valid edit; nothing until the first edit. */
export function startAutosave(running: Running, base: string, projects: ProjectControls): void {
  running.autosave?.dispose();
  running.autosave = createAutosave({
    base,
    session: running.session,
    store: {
      saveLocal: (source) => {
        void projects.persist(source);
        return true;
      },
    },
    setTimer: (run, ms) => {
      const timer = window.setTimeout(run, ms);
      return () => window.clearTimeout(timer);
    },
  });
}

/** Before the first tap there is nothing to save; a received link waits for an autosave like this. */
export const NO_AUTOSAVE: Autosave = { rebase: () => undefined, flush: () => undefined, dispose: () => undefined };
