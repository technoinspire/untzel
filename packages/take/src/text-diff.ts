// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A take keeps text, never the Program of what sounds (RNF5): each change is the edit
// between two texts, found by their common prefix and suffix in O(n).
import type { TextDiff } from "./take";

/** The smallest middle edit that turns `previous` into `next`, never splitting a surrogate pair. */
export function diffText(previous: string, next: string): TextDiff {
  const shorter = Math.min(previous.length, next.length);
  let prefix = 0;
  while (prefix < shorter && previous.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix += 1;
  if (prefix > 0 && isHighSurrogate(previous.charCodeAt(prefix - 1))) prefix -= 1;
  let suffix = 0;
  const available = shorter - prefix;
  while (
    suffix < available &&
    previous.charCodeAt(previous.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  if (suffix > 0 && isLowSurrogate(previous.charCodeAt(previous.length - suffix))) suffix -= 1;
  return {
    at: prefix,
    remove: previous.length - prefix - suffix,
    insert: next.slice(prefix, next.length - suffix),
  };
}

/** Applies a diff made by diffText; a RangeError when `at` or `remove` leave the text. */
export function applyTextDiff(previous: string, diff: TextDiff): string {
  const { at, remove } = diff;
  if (!Number.isInteger(at) || !Number.isInteger(remove) || at < 0 || remove < 0 || at + remove > previous.length) {
    throw new RangeError(`text diff outside the text: at ${at}, remove ${remove}, length ${previous.length}`);
  }
  return previous.slice(0, at) + diff.insert + previous.slice(at + remove);
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
