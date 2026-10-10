// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ControlsPort } from "@untzel/skin-contract";
import { stepLength } from "../text/lengths";
import type { ShortcutAction } from "@untzel/skin-contract";
import { strings } from "../../copy/copy";

// What each desktop shortcut does, given the shell's own
// actions. shortcuts.ts maps keys to actions; this runs them.

export interface ShellActions {
  openLibrary(): void;
  applyNow(): void;
  /** False when nothing was open, so Esc falls through. */
  dismiss(): boolean;
  toggleControls(): void;
  /** Says a sentence once in the shell's polite live region. */
  announce(message: string): void;
}

/** True when the shortcut did something (the key's default is then prevented). */
// Over 40 lines: one exhaustive case per shortcut action of shortcuts.ts, each a call or two.
export function runShortcut(action: ShortcutAction, port: ControlsPort, shell: ShellActions): boolean {
  const view = port.view();
  switch (action.kind) {
    case "toggle-play":
      if (view.phase === "idle") port.start(view.templates.selected);
      else port.togglePlay();
      return true;
    case "stop":
      port.stop();
      return true;
    case "toggle-track": {
      const track = view.tracks[action.index];
      if (track === undefined) return false;
      port.toggleTrack(track.name);
      return true;
    }
    case "add-track":
      shell.openLibrary();
      return true;
    case "drop":
      // In Song a silent key read as broken: it says where it works.
      if (view.transport.mode === "song") return announced(shell, strings.dropLoopOnly);
      if (view.transport.mode !== "loop") return false;
      port.drop();
      return true;
    case "undo":
      port.undo();
      return true;
    case "redo":
      port.redo();
      return true;
    case "apply-now":
      shell.applyNow();
      return true;
    case "close":
      return shell.dismiss();
    case "toggle-controls":
      shell.toggleControls();
      return true;
    case "save":
      port.saveProjectNow();
      return true;
    case "loop-length": {
      if (view.transport.mode === "song") return announced(shell, strings.loopLengthLoopOnly);
      if (view.transport.mode !== "loop") return false;
      // The musical lengths of the chip: 4 → 8 → 16, and 6 (written in the
      // code) → 4 or 8.
      const bars = stepLength(view.transport.loopBars, action.delta);
      if (bars === null) return false;
      port.setLoopBars(bars);
      return true;
    }
  }
}
/** The key did its job by saying why nothing else happens. */
function announced(shell: ShellActions, message: string): boolean {
  shell.announce(message);
  return true;
}
