// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The keys that put the Code panel's cursor on an offset of its text, as a person moves it
// with the keyboard: to the start or the end of the text, down the lines, then along the
// line. On a phone the panel wraps long lines, so a line down is not a text line: there the
// cursor goes character by character from the nearer end. Pure.
export interface CaretKeys {
  /** One press each, in order. */
  readonly keys: readonly string[];
}

function repeat(key: string, times: number): string[] {
  return Array.from({ length: Math.max(0, times) }, () => key);
}

/** From the nearer end of the text, one character at a time. */
function byCharacter(text: string, offset: number): string[] {
  return offset <= text.length - offset
    ? ["ControlOrMeta+Home", ...repeat("ArrowRight", offset)]
    : ["ControlOrMeta+End", ...repeat("ArrowLeft", text.length - offset)];
}

/** Down the text lines from the top, then along the line from its nearer end. */
function byLine(text: string, offset: number): string[] {
  const before = text.slice(0, offset);
  const line = before.split("\n").length - 1;
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEnd = text.indexOf("\n", offset) < 0 ? text.length : text.indexOf("\n", offset);
  const column = offset - lineStart;
  const along = column <= lineEnd - offset ? repeat("ArrowRight", column) : ["End", ...repeat("ArrowLeft", lineEnd - offset)];
  return ["ControlOrMeta+Home", ...repeat("ArrowDown", line), ...along];
}

/** The keys to the caret at `offset`, then `selected` characters selected after it. */
export function caretKeys(text: string, offset: number, selected: number, wraps: boolean): CaretKeys {
  if (offset < 0 || offset > text.length || offset + selected > text.length) throw new RangeError(`offset ${offset} outside the text`);
  const moves = wraps || !text.includes("\n") ? byCharacter(text, offset) : byLine(text, offset);
  const shortest = byCharacter(text, offset).length < moves.length ? byCharacter(text, offset) : moves;
  return { keys: [...shortest, ...repeat("Shift+ArrowRight", selected)] };
}
