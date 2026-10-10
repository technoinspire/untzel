// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setAttributes } from "../dom";
import { icon } from "../icons";
import type { SessionIntents } from "@untzel/skin-contract";
import type { HistoryView } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";
import { undoToastText } from "../../behavior/feedback/undo-toast-text";

// Undo and Redo by touch: two 44 px drawn buttons over the one session
// history, in the transport below 1200 px and in the Code panel header. Empty, they stay
// focusable with aria-disabled and a dashed ring. A press says what changed in a toast.

export interface UndoRedoButtons {
  readonly root: HTMLElement;
  update(history: HistoryView): void;
}

export function createUndoRedoButtons(intents: Pick<SessionIntents, "undo" | "redo">, className: string, onNote: (text: string) => void): UndoRedoButtons {
  const press = (direction: "undo" | "redo", node: HTMLButtonElement): void => {
    if (node.getAttribute("aria-disabled") === "true") return;
    const notice = direction === "undo" ? intents.undo() : intents.redo();
    onNote(undoToastText(direction, notice));
  };
  const undo: HTMLButtonElement = button("ui-round ui-undo-redo__button", text.undo, () => press("undo", undo), [icon("undo")]);
  const redo: HTMLButtonElement = button("ui-round ui-undo-redo__button", text.redo, () => press("redo", redo), [icon("redo")]);
  setAttributes(undo, { "aria-keyshortcuts": "Control+Z Meta+Z" });
  setAttributes(redo, { "aria-keyshortcuts": "Control+Shift+Z Meta+Shift+Z" });
  const root = element("div", { className: `ui-undo-redo ${className}`, attributes: { role: "group", "aria-label": text.history } }, [undo, redo]);
  return {
    root,
    update(history) {
      setAttributes(undo, { "aria-disabled": history.canUndo ? null : "true" });
      setAttributes(redo, { "aria-disabled": history.canRedo ? null : "true" });
    },
  };
}
