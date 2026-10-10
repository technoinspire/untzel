// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The waiting stage's and the project library's intents of the fake session: the tap
// plays the template, the picker remembers its choice, and a rename shows in the bar;
// switching projects is the real page's.

import type { ProjectIntents, SessionIntents } from "@untzel/skin-contract";
import type { FakeState } from "../fake-state";

function start(state: FakeState, template: string): void {
  state.template = template;
  if (state.phase !== "idle") return;
  state.phase = "running";
  state.emitMode();
  state.announce(`${template} plays on the next bar.`);
  state.emit();
}

function retry(state: FakeState): void {
  state.phase = "idle";
  state.emitMode();
  state.emit();
}

type PageIntents = Pick<SessionIntents, "start" | "selectTemplate" | "openTemplateStyle" | "retry"> & ProjectIntents;

export function fakePageIntents(state: FakeState): PageIntents {
  return {
    start: (template) => start(state, template),
    selectTemplate: (template) => {
      state.template = template;
      state.emit();
    },
    openTemplateStyle: (style) => {
      state.templateStyle = style;
      state.emit();
    },
    retry: () => retry(state),
    newProject: () => undefined,
    openProject: () => undefined,
    continueProject: () => start(state, state.template),
    renameSong: (title) => {
      state.title = title;
      state.emit();
    },
    renameProject: () => undefined,
    duplicateProject: () => undefined,
    deleteProject: () => undefined,
    undoDeleteProject: () => undefined,
    saveProjectFile: () => undefined,
    saveProjectNow: () => undefined,
  };
}
