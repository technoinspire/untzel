// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Desktop shortcuts. Pure: the shell feeds key
// descriptors and dispatches the returned action.

export type ShortcutAction =
  | { readonly kind: "toggle-play" }
  | { readonly kind: "stop" }
  | { readonly kind: "toggle-track"; readonly index: number }
  | { readonly kind: "add-track" }
  | { readonly kind: "drop" }
  | { readonly kind: "undo" }
  | { readonly kind: "redo" }
  | { readonly kind: "apply-now" }
  | { readonly kind: "close" }
  | { readonly kind: "toggle-controls" }
  /** Mod+S: saves the project now, never the browser's save dialog. */
  | { readonly kind: "save" }
  /** "[" and "]": the previous or next musical loop length, 1, 2, 4, 8 or 16 bars. */
  | { readonly kind: "loop-length"; readonly delta: -1 | 1 };

export interface KeyDescriptor {
  readonly key: string;
  /** Cmd on macOS, Ctrl elsewhere. */
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  /** Focus is in the code editor or another text field. */
  readonly inText: boolean;
  /**
   * Focus is on a control that Space presses (button, switch, select), reached by the
   * keyboard. A control focused by a click does not keep Space: after clicking Mute or
   * Song, Space plays and pauses again. A slider never takes Space.
   */
  readonly onControl: boolean;
}

export function shortcutFor(key: KeyDescriptor): ShortcutAction | null {
  if (key.alt) return null;
  if (key.mod) return modShortcut(key);
  if (key.key === "Escape") return { kind: "close" };
  if (key.inText || key.shift) return null;
  if (key.key === " ") return key.onControl ? null : { kind: "toggle-play" };
  if (/^[1-9]$/.test(key.key)) return { kind: "toggle-track", index: Number(key.key) - 1 };
  const lower = key.key.toLowerCase();
  if (lower === "a") return { kind: "add-track" };
  if (lower === "d") return { kind: "drop" };
  if (lower === "h") return { kind: "toggle-controls" };
  if (key.key === "[") return { kind: "loop-length", delta: -1 };
  if (key.key === "]") return { kind: "loop-length", delta: 1 };
  return null;
}

function modShortcut(key: KeyDescriptor): ShortcutAction | null {
  const lower = key.key.toLowerCase();
  // In a text field the field owns undo, redo and Mod+Enter: the editor sends them to
  // the session itself, and a second call here would count every press twice.
  if (key.inText && (lower === "z" || key.key === "Enter")) return null;
  if (lower === "z") return key.shift ? { kind: "redo" } : { kind: "undo" };
  if (key.key === "Enter") return { kind: "apply-now" };
  if (key.key === ".") return { kind: "stop" };
  if (lower === "s" && !key.shift) return { kind: "save" };
  return null;
}

/** `focusByPointer`: the focused control was clicked (focus-origin.ts), so Space is not its. */
export function describeKey(event: KeyboardEvent, isMac: boolean, focusByPointer = false): KeyDescriptor {
  const target = event.target instanceof Element ? event.target : null;
  // A search field is a text field too: "a" typed in the library's search is a letter, not Add.
  const inText = target?.closest(".cm-editor, input[type='text'], input[type='search'], textarea, [contenteditable='true']") != null;
  // Every switch, radio, tab and menu item in the app is a <button> (initial JS budget).
  const onControl = !focusByPointer && target?.closest("button, select") != null;
  return {
    key: event.key,
    mod: isMac ? event.metaKey : event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
    inText,
    onControl,
  };
}
