// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { fixOf, type DiagnosticFix, type Range } from "./diagnostics";
import { printNumber } from "../edits/print";
import { messages } from "../copy/messages";
import type { Token } from "../highlight/outline";
import type { Suggestion } from "./suggest";

// The corrections the analysis attaches to its diagnostics.
// Each one touches only the range it names.

/** `kik` -> `kick` ("Change to kick"); null when there is nothing to suggest. */
export function replaceFix(token: Token, replacement: string | null, safe = true): DiagnosticFix | null {
  if (replacement === null || replacement === token.text) return null;
  return fixOf(messages.fixChange(replacement), [{ from: token.from, to: token.to, insert: replacement }], safe);
}

/** The closest name for an unknown one; safe only when no other candidate is as close. */
export function suggestionFix(token: Token, suggestion: Suggestion | null): DiagnosticFix | null {
  return suggestion === null ? null : replaceFix(token, suggestion.text, suggestion.safe);
}

/**
 * A name out of a fixed list: the closest one when it is near (a typo), else `fallback`,
 * never safe: picking a name the person did not write is their choice.
 */
export function choiceFix(token: Token, suggestion: Suggestion | null, fallback: string | undefined): DiagnosticFix | null {
  if (suggestion !== null) return suggestionFix(token, suggestion);
  return fallback === undefined ? null : replaceFix(token, fallback, false);
}

/**
 * Every written copy of one unknown name to the suggestion, in one edit: a track renamed
 * on its own line ("kick:" -> "kik:") and still listed as kick in three sections.
 */
export function changeEveryFix(tokens: readonly Token[], suggestion: Suggestion | null): DiagnosticFix | null {
  const [first] = tokens;
  if (first === undefined || suggestion === null) return null;
  if (tokens.length === 1) return suggestionFix(first, suggestion);
  const changes = [...tokens].sort((a, b) => a.from - b.from).map((token) => ({ from: token.from, to: token.to, insert: suggestion.text }));
  return fixOf(messages.fixChangeEvery(first.text, suggestion.text), changes, suggestion.safe);
}

/** What a numeric rule accepts, for clamping. */
export interface Bounds {
  readonly min: number;
  readonly max: number;
  readonly integer: boolean;
}

/** The written number moved to the nearest value the rule accepts. */
export function clampFix(token: Token, value: number, bounds: Bounds): DiagnosticFix | null {
  let clamped = Math.min(Math.max(value, bounds.min), bounds.max);
  if (bounds.integer) {
    clamped = Math.round(clamped);
    if (clamped < bounds.min) clamped = Math.ceil(bounds.min);
    if (clamped > bounds.max) clamped = Math.floor(bounds.max);
  }
  return replaceFix(token, printNumber(clamped));
}

/** "sine(8)" -> "sine(8) 40..8000": the whole range of the parameter. */
export function rangeFix(signal: Token, bounds: Bounds): DiagnosticFix | null {
  const low = printNumber(bounds.min);
  const high = printNumber(bounds.max);
  if (low === null || high === null) return null;
  const range = `${low}..${high}`;
  return fixOf(messages.fixAddRange(range), [{ from: signal.to, to: signal.to, insert: ` ${range}` }], true);
}

/** "gain" -> "gain 0.8", from the example of the rule ("gain 0.8"). */
export function valueFix(name: Token, example: string): DiagnosticFix | null {
  const prefix = `${name.text} `;
  if (!example.startsWith(prefix)) return null;
  const value = example.slice(prefix.length);
  return fixOf(messages.fixAddValue(example), [{ from: name.to, to: name.to, insert: ` ${value}` }], true);
}

/** "kick" -> "kick x... x... x... x...": the instrument's first pattern after `after`. */
export function patternFix(after: Token, pattern: string): DiagnosticFix {
  return fixOf(messages.fixAddValue(pattern), [{ from: after.to, to: after.to, insert: ` ${pattern}` }], true);
}

/** Removes a modifier that a later one with the same name already overrides. */
export function removeFix(removal: Range, name: string): DiagnosticFix {
  return fixOf(messages.fixRemoveEarlier(name), [{ from: removal.from, to: removal.to, insert: "" }], true);
}

/** A repeated name gets the next free one; not safe, it changes which one is meant. */
export function renameFix(token: Token, next: string): DiagnosticFix {
  return fixOf(messages.fixRename(next), [{ from: token.from, to: token.to, insert: next }], false);
}
