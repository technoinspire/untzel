// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The fake session's text: the editor's port, typing and Apply now, and undo and redo
// over the text's history.

import type { SessionIntents } from "@untzel/skin-contract";
import type { CodePort } from "@untzel/editor";
import type { UndoNotice } from "@untzel/presentation/view-model";
import type { FakeState } from "../fake-state";

function undo(state: FakeState): UndoNotice | null {
  const previous = state.history.pop();
  if (previous === undefined) return null;
  state.future.push(state.source);
  state.setSource(previous, false);
  return null;
}

function redo(state: FakeState): UndoNotice | null {
  const next = state.future.pop();
  if (next === undefined) return null;
  state.history.push(state.source);
  state.setSource(next, false);
  return null;
}

function edit(state: FakeState, source: string): void {
  if (source === state.source) return;
  state.history.push(state.source);
  state.future = [];
  state.setSource(source, true);
}

export function fakeHistory(state: FakeState): Pick<SessionIntents, "undo" | "redo"> {
  return { undo: () => undo(state), redo: () => redo(state) };
}

/** The editor's port. A separate object: CodePort.subscribe and ViewSource.subscribe differ. */
export function fakeCodePort(state: FakeState): CodePort {
  return {
    code: () => state.code(),
    subscribe: (listener) => {
      state.codeListeners.add(listener);
      return () => state.codeListeners.delete(listener);
    },
    onSounding: (listener) => {
      state.soundingListeners.add(listener);
      return () => state.soundingListeners.delete(listener);
    },
    edit: (source) => edit(state, source),
    applyNow: (source) => {
      edit(state, source);
      state.announce("Applies on the next bar.");
    },
    undo: () => undo(state),
    redo: () => redo(state),
  };
}
