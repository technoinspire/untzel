// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { SessionIntents } from "@untzel/skin-contract";
import { strings, text, type Label } from "../../copy/copy";

// Delete removed a track at once and the phone had no Undo anywhere.
// After a delete a toast says so with Undo; Undo turns it into Redo, and back, so
// both are reachable by touch. Undo and redo are the session's own (the text history).
// Every text is a reader, so a language switch while the toast shows rewrites it.

export type UndoAction = "undo" | "redo";

export interface UndoTexts {
  /** "ride deleted". */
  readonly done: () => string;
  /** "ride is back". */
  readonly undone: () => string;
}

export interface UndoOffer {
  readonly message: () => string;
  readonly label: () => string;
  readonly action: UndoAction;
}

/** What the toast says before (undo) or after (redo) the edit is taken back. */
export function undoOffer(texts: UndoTexts, action: UndoAction): UndoOffer {
  return action === "undo"
    ? { message: texts.done, label: text.undo, action }
    : { message: texts.undone, label: text.redo, action };
}

export function deletedTexts(track: string): UndoTexts {
  return { done: () => strings.trackDeleted(track), undone: () => strings.isBack(track) };
}

/** "open removed" (Use Tone), "gain signal removed" (the fader over a signal). */
export function removedTexts(what: string): UndoTexts {
  return { done: () => strings.removed(what), undone: () => strings.isBack(what) };
}

/** The toast as the offer sees it: shows one offer at a time. */
export interface OfferToast {
  /** `durationMs`: 6 s by default (a track), 10 s for a project. A reader follows the language. */
  show(message: Label, label: Label, onAction: () => void, durationMs?: number): void;
}

/** Shows `texts` with Undo; each tap runs the session's undo or redo and flips the offer. */
export function offerUndo(toast: OfferToast, history: Pick<SessionIntents, "undo" | "redo">, texts: UndoTexts): void {
  const show = (action: UndoAction): void => {
    const offer = undoOffer(texts, action);
    toast.show(offer.message, offer.label, () => {
      if (offer.action === "undo") history.undo();
      else history.redo();
      show(offer.action === "undo" ? "redo" : "undo");
    });
  };
  show("undo");
}
