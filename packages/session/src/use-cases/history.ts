// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/** Texts kept for undo; older ones are dropped. */
export const HISTORY_LIMIT = 200;

/**
 * What one step of the history changed, so a touch Undo can say it ("Undid: gain on
 * hat"). Structured, not words: the controls write the English.
 */
export interface HistoryLabel {
  /** The parameter, statement or gesture: "gain", "tempo", "key", "rename", "pattern"… */
  readonly what: string;
  /** The track or part it touched; null for the whole song. */
  readonly target: string | null;
}

/** How a gesture's text enters the history (Session.applyText). */
export interface EditOptions {
  readonly label?: HistoryLabel;
  /** Edits with the same key in a row are one undo step (the tempo editor's +, a drag). */
  readonly mergeKey?: string;
  /** A rename: solo, session state never written, follows the name. */
  readonly renamed?: { readonly from: string; readonly to: string };
}

/** An undone or redone step: the text to go to and what the step was. */
export interface HistoryStep {
  readonly text: string;
  readonly label: HistoryLabel | null;
}

interface Entry {
  readonly text: string;
  readonly label: HistoryLabel | null;
}

/**
 * Undo and redo over whole source texts. An edit from a gesture and a pause in typing are
 * both one step: "Undo" undoes the last edit, from the finger or the keyboard.
 * Edits with the same merge key in a row (the + of the tempo editor pressed five times, a
 * fader drag) fuse into one step until seal(), another key, undo or redo closes it.
 */
export class TextHistory {
  readonly #undo: Entry[] = [];
  readonly #redo: Entry[] = [];
  #openKey: string | null = null;

  /** Remembers the text being replaced by a new edit; a new edit clears redo. */
  record(previous: string, label: HistoryLabel | null = null, mergeKey: string | null = null): void {
    this.#redo.length = 0;
    const fuses = mergeKey !== null && mergeKey === this.#openKey && this.#undo.length > 0;
    this.#openKey = mergeKey;
    if (fuses) return;
    this.#undo.push({ text: previous, label });
    if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
  }

  /** Closes the open step: the next edit is a step of its own, whatever its key. */
  seal(): void {
    this.#openKey = null;
  }

  /** The step to go back to, or null; `current` becomes redoable. */
  undo(current: string): HistoryStep | null {
    this.#openKey = null;
    const previous = this.#undo.pop();
    if (previous === undefined) return null;
    this.#redo.push({ text: current, label: previous.label });
    return previous;
  }

  /** The step to go forward to, or null; `current` becomes undoable. */
  redo(current: string): HistoryStep | null {
    this.#openKey = null;
    const next = this.#redo.pop();
    if (next === undefined) return null;
    this.#undo.push({ text: current, label: next.label });
    return next;
  }

  /** Another song opened: its undo never reaches the one before. */
  clear(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
  }
  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }
}
