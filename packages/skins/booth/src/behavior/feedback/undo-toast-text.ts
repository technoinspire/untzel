// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { UndoNotice } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";

// What a touch Undo or Redo says it did: "Undid: gain on hat". The
// session labels each step with what it changed; the words are written here.

/** Gestures whose label reads as an action on the target rather than "<what> on <target>". */
const ACTIONS: Readonly<Record<string, () => string>> = {
  add: () => strings.undoAdding,
  delete: () => strings.undoDeleting,
  duplicate: () => strings.undoCopying,
  rename: () => strings.undoRenamingTo,
  "add part": () => strings.undoAddingPart,
};

function described(notice: UndoNotice | null): string {
  if (notice === null) return strings.lastChange;
  const action = ACTIONS[notice.what]?.();
  if (action !== undefined) return notice.target === null ? action : `${action} ${notice.target}`;
  return notice.target === null ? notice.what : strings.changeOn(notice.what, notice.target);
}

export function undoToastText(direction: "undo" | "redo", notice: UndoNotice | null): string {
  return direction === "undo" ? strings.undid(described(notice)) : strings.redid(described(notice));
}
