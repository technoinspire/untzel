// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The rename field shared by the song title and the track and part names: Enter commits,
// Esc cancels, leaving commits, and editing starts on the whole name or after it.

/** What a key does in the field; null: it types (the shell ignores keys in text). */
export function renameKeyAction(key: string): "commit" | "cancel" | null {
  if (key === "Enter") return "commit";
  return key === "Escape" ? "cancel" : null;
}

/**
 * Enter commits; Esc cancels and closes nothing else around the field. Leaving commits,
 * except for a move to `inEditor`, the button beside the field (Done, Cancel).
 */
export function bindRenameField(input: HTMLInputElement, inEditor: HTMLElement, commit: (isLeaving: boolean) => void, cancel: () => void): void {
  input.addEventListener("keydown", (event) => {
    const action = renameKeyAction(event.key);
    if (action === null) return;
    event.preventDefault();
    if (action === "commit") commit(false);
    else {
      event.stopPropagation();
      cancel();
    }
  });
  input.addEventListener("blur", (event) => {
    if (event.relatedTarget !== inEditor) commit(true);
  });
}

/** Fills the field and focuses it: the desktop selects the name to replace it; a phone keeps the cursor at the end. */
export function startEditing(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.focus();
  if (window.matchMedia("(pointer: fine)").matches) input.select();
  else input.setSelectionRange(value.length, value.length);
}
