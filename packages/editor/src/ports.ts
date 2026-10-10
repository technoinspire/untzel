// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { CodeCompletion, CommandOutcome, HoverHelp, LineCompletion, SessionAction } from "@untzel/commands";
import type { Diagnostic } from "@untzel/language";
import type { Unsubscribe } from "@untzel/session";

/** UTF-16 offsets into the source, half-open, as in core's SourceRange. */
export interface TextRange {
  readonly from: number;
  readonly to: number;
}

/** An edit the interface made on the user's behalf. */
export interface InterfaceChange {
  /** Increments per change, so the same line can flash twice. */
  readonly id: number;
  /** 1-based. */
  readonly line: number;
  /** For example "Line 11 changed by the acid track: cutoff became sine(8)." */
  readonly message: string;
}

export interface CodeState {
  readonly source: string;
  /**
   * The text of the program that plays (the last valid one): the sounding ranges point
   * into it. Equal to `source` while the text is valid.
   */
  readonly programSource: string;
  /** Errors and warnings of the text, each with its severity. */
  readonly diagnostics: readonly Diagnostic[];
  readonly lastChange: InterfaceChange | null;
}

/**
 * What the editor needs from the session. The editor never keeps text of its own:
 * every keystroke goes back through edit(), and the session owns the source.
 */
export interface CodePort {
  code(): CodeState;
  subscribe(listener: (state: CodeState) => void): Unsubscribe;
  /** Tokens sounding now, already delayed to the heard time, in offsets of `programSource`. */
  onSounding(listener: (ranges: readonly TextRange[]) => void): Unsubscribe;
  /** Called after the 300 ms typing pause. */
  edit(source: string): void;
  /** Mod+Enter: apply on the next bar without waiting for the pause. */
  applyNow(source: string): void;
  undo(): void;
  redo(): void;
}

/** The page's polite live region (role="status"), shared with the controls. */
export interface Announcer {
  announce(message: string): void;
}
/** Completion and hover help for the code (@untzel/commands' Composer provides it). */
export interface CodeHelp {
  completeCode(source: string, offset: number): CodeCompletion | null;
  hover(source: string, offset: number): HoverHelp | null;
}

/** What the terminal reads from the session. */
export interface TerminalState {
  readonly source: string;
  readonly playing: boolean;
  /** Bar since play of the latest boundary scheduled (PlaybackPosition.bar); null when stopped. */
  readonly bar: number | null;
}

/** Why a session use case refused, in the session's own codes (CommandFailure). */
export type ActionResult =
  | { readonly ok: true; readonly released?: boolean }
  | { readonly ok: false; readonly code: string };

/**
 * The terminal's way into the session. A proposal goes through apply(), the same
 * applyText as typing; play, stop, drop, solo, undo and redo are the session's use cases.
 */
export interface TerminalPort {
  state(): TerminalState;
  subscribe(listener: (state: TerminalState) => void): Unsubscribe;
  apply(source: string): void;
  /** Solo again on the soloed track releases it; the result says so. */
  perform(action: SessionAction): ActionResult;
}

/** The command layer the terminal runs lines through. */
export interface TerminalCommands {
  run(line: string, source: string): CommandOutcome;
  completeLine(line: string, cursor: number, source: string): LineCompletion;
}
