// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { DiffLine } from "./diff";

// What a command line turns into. Nothing here touches the session: the terminal view
// applies a proposal through applyText and an action through the session's use cases.

/** A change of the whole text, the same path for every command and for a future assistant. */
export interface Proposal {
  readonly before: string;
  readonly after: string;
  /** The command as typed, for the preview header: "remove ride". */
  readonly title: string;
  /** The result line once applied: "Removed ride." */
  readonly summary: string;
  /** Only the lines that change, in order. */
  readonly diff: readonly DiffLine[];
  /** True for destructive changes and changes of more than one line: Apply or Cancel first. */
  readonly needsPreview: boolean;
}

/** The session use cases a command can ask for; they never go through the text. */
export type SessionAction =
  | { readonly kind: "play" }
  | { readonly kind: "stop" }
  | { readonly kind: "drop" }
  | { readonly kind: "undo" }
  | { readonly kind: "redo" }
  | { readonly kind: "solo"; readonly track: string };

/** One line of help or explanation; `code` lines are shown in the monospace face. */
export interface InfoLine {
  readonly text: string;
  readonly code?: boolean;
}

export type CommandOutcome =
  | { readonly kind: "empty" }
  | { readonly kind: "clear" }
  | { readonly kind: "info"; readonly lines: readonly InfoLine[] }
  | { readonly kind: "edit"; readonly proposal: Proposal }
  | { readonly kind: "action"; readonly action: SessionAction }
  /** Never thrown: a message and, when one exists, a whole command line to try. */
  | { readonly kind: "error"; readonly message: string; readonly suggestion: string | null };

export function error(message: string, suggestion: string | null = null): CommandOutcome {
  return { kind: "error", message, suggestion };
}

export function info(...lines: readonly (string | InfoLine)[]): CommandOutcome {
  return { kind: "info", lines: lines.map((line) => (typeof line === "string" ? { text: line } : line)) };
}
