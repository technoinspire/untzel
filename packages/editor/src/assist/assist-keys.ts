// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { completionKeymap } from "@codemirror/autocomplete";
import type { KeyBinding } from "@codemirror/view";

// The keys of the completion list without Alt+I.
// CodeMirror binds Alt+I to "open the list" on a Mac, at the highest precedence,
// so the help under the cursor never opened from the keyboard.

/** Opens the help under the cursor; Esc closes it. */
export const HELP_KEY = "Alt-i";

/** CodeMirror's completion keys, minus every binding of the help key. */
export function completionKeys(): readonly KeyBinding[] {
  return completionKeymap.filter((binding) => binding.key !== HELP_KEY && binding.mac !== HELP_KEY);
}
