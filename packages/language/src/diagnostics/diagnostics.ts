// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { TextChange } from "../edits/text-changes";
import type { MessageKey } from "../copy/messages";

/** Stable English identifiers: part of the public contract. */
export const DIAGNOSTIC_CODES = [
  "UNKNOWN_INSTRUMENT",
  "DUPLICATE_TRACK_NAME",
  "UNKNOWN_TRACK",
  "UNKNOWN_SECTION",
  "DUPLICATE_SECTION_NAME",
  "UNKNOWN_MODIFIER",
  "OUT_OF_RANGE",
  "EMPTY_PATTERN",
  "INVALID_NOTE",
  "SIGNAL_NEEDS_RANGE",
  "SOURCE_TOO_LONG",
  "SYNTAX_ERROR",
  "INTERNAL_ERROR",
  "UNKNOWN_SCALE",
  "NAME_TOO_LONG",
  "TOO_MANY_STEPS",
  "TOO_MANY_BARS",
  "PATTERN_KIND_MISMATCH",
  "MISSING_VALUE",
  "DUPLICATE_SONG",
  "OUT_OF_ORDER",
  "DUPLICATE_STATEMENT",
  "DUPLICATE_MODIFIER",
  "UNKNOWN_PRESET",
  "UNKNOWN_CHOICE",
  "SIGNAL_NEEDS_NUMBER",
  "NO_EFFECT",
  "TOO_MANY_MODULATORS",
  "DUPLICATE_LOOP_SECTION",
  "EMPTY_TITLE",
  "TITLE_TOO_LONG",
  "SIGNAL_NOT_ALLOWED",
  "NOTHING_TO_PLAY",
] as const;
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];

/** What a message argument can be; all of them survive postMessage (structured clone). */
export type MessageArg = string | number | null | readonly string[];

/** One message of messages.ts: its key, its arguments and the English text. */
export interface DiagnosticMessage {
  readonly key: MessageKey;
  readonly args: readonly unknown[];
  readonly text: string;
}
export interface Diagnostic {
  readonly code: DiagnosticCode;
  /** English: logs, the simulator, tests and llms-full.txt read this one. */
  readonly message: string;
  /** With messageArgs, what a view translates: englishMessages[messageKey](...messageArgs). */
  readonly messageKey: MessageKey;
  readonly messageArgs: readonly MessageArg[];
  /** UTF-16 offsets into the source, half-open. */
  readonly from: number;
  readonly to: number;
  readonly severity: "error" | "warning";
  /** A known correction. */
  readonly fix?: DiagnosticFix;
}

/**
 * Replacing these ranges resolves the diagnostic. `safe` fixes keep what the text means
 * (a typo, a clamp); the others change an identity and wait for the person to choose.
 */
export interface DiagnosticFix {
  /** English, for a button: `Change to kick`. */
  readonly title: string;
  /** With titleArgs, what a view translates, as messageKey and messageArgs. */
  readonly titleKey: MessageKey;
  readonly titleArgs: readonly MessageArg[];
  /** In offsets of the analyzed text, not overlapping. */
  readonly changes: readonly TextChange[];
  readonly safe: boolean;
}

/** A half-open range of the source, the anchor of a diagnostic. */
export interface Range {
  readonly from: number;
  readonly to: number;
}

/** The arguments of a message reference, copied so a diagnostic never shares an array. */
function argsOf(ref: DiagnosticMessage): MessageArg[] {
  return ref.args.map((arg) => (Array.isArray(arg) ? [...(arg as readonly string[])] : arg)) as MessageArg[];
}

/** A diagnostic from a message reference; its arguments are copied, never shared. */
export function diagnosticOf(
  code: DiagnosticCode,
  ref: DiagnosticMessage,
  range: Range,
  severity: Diagnostic["severity"],
): Diagnostic {
  return { code, message: ref.text, messageKey: ref.key, messageArgs: argsOf(ref), from: range.from, to: range.to, severity };
}

/** A quick fix titled by a message reference, so the button translates like the message. */
export function fixOf(title: DiagnosticMessage, changes: readonly TextChange[], safe: boolean): DiagnosticFix {
  return { title: title.text, titleKey: title.key, titleArgs: argsOf(title), changes, safe };
}

/** Collects the diagnostics of one analysis. */
export class DiagnosticList {
  readonly #items: Diagnostic[] = [];

  error(code: DiagnosticCode, ref: DiagnosticMessage, range: Range, fix?: DiagnosticFix | null): void {
    this.#push(diagnosticOf(code, ref, range, "error"), fix);
  }

  warning(code: DiagnosticCode, ref: DiagnosticMessage, range: Range, fix?: DiagnosticFix | null): void {
    this.#push(diagnosticOf(code, ref, range, "warning"), fix);
  }

  #push(diagnostic: Diagnostic, fix: DiagnosticFix | null | undefined): void {
    this.#items.push(fix === null || fix === undefined ? diagnostic : { ...diagnostic, fix });
  }

  hasErrors(): boolean {
    return this.#items.some((item) => item.severity === "error");
  }

  /** Sorted by position; stable for diagnostics at the same position. */
  all(): readonly Diagnostic[] {
    return [...this.#items].sort((a, b) => a.from - b.from);
  }

  warnings(): readonly Diagnostic[] {
    return this.all().filter((item) => item.severity === "warning");
  }
}
