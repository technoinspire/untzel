// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { AppPhase } from "@untzel/presentation/view-model";
import { trackFocusOrigin } from "../behavior/focus/focus-origin";
import type { ControlsPort } from "@untzel/skin-contract";
import { runShortcut, type ShellActions } from "../behavior/keyboard/shortcut-actions";
import { describeKey, shortcutFor, type KeyDescriptor, type ShortcutAction } from "@untzel/skin-contract";

/** Cmd is the shortcuts' modifier on Apple platforms, Ctrl elsewhere. */
export function isMacPlatform(platform: string): boolean {
  return /Mac|iPhone|iPad/.test(platform);
}

/** Mod+Enter belongs to a text field; outside the running music only Space and Esc act. */
export function shouldRunShortcut(action: ShortcutAction, key: KeyDescriptor, phase: AppPhase): boolean {
  if (action.kind === "apply-now" && key.inText) return false;
  const isAnyPhase = action.kind === "toggle-play" || action.kind === "close";
  return phase === "running" || isAnyPhase;
}

/**
 * The desktop shortcuts on the document. The focus origin listens first (capture), so a
 * click on a control hands Space back to play and pause. Returns detach.
 */
export function attachShellKeyboard(port: ControlsPort, actions: ShellActions, isMac: boolean): () => void {
  const focusOrigin = trackFocusOrigin(document);
  const onKey = (event: KeyboardEvent): void => {
    const key = describeKey(event, isMac, focusOrigin.isPointer());
    const action = shortcutFor(key);
    if (action === null || !shouldRunShortcut(action, key, port.view().phase)) return;
    if (runShortcut(action, port, actions)) event.preventDefault();
  };
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("keydown", onKey);
    focusOrigin.detach();
  };
}
