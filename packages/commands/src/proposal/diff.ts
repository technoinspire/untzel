// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Line diff for the terminal's preview: what a change removes and adds, with the line
// numbers the person sees in the editor.

export interface DiffLine {
  readonly kind: "added" | "removed";
  /** 1-based: in the text before for a removed line, after for an added one. */
  readonly line: number;
  readonly text: string;
}

function splitLines(text: string): readonly string[] {
  return text.split(/\r?\n/);
}

/** Longest common subsequence table over the lines between the common head and tail. */
function lcsTable(before: readonly string[], after: readonly string[]): number[][] {
  const table = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      const row = table[i] as number[];
      row[j] = before[i] === after[j] ? (table[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(table[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  return table;
}

/** The changed lines only; removed before added where a line is replaced. */
export function lineDiff(beforeText: string, afterText: string): readonly DiffLine[] {
  const before = splitLines(beforeText);
  const after = splitLines(afterText);
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head += 1;
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1;
  }
  const oldMiddle = before.slice(head, before.length - tail);
  const newMiddle = after.slice(head, after.length - tail);
  const table = lcsTable(oldMiddle, newMiddle);
  const out: DiffLine[] = [];
  let block: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < oldMiddle.length || j < newMiddle.length) {
    if (i < oldMiddle.length && j < newMiddle.length && oldMiddle[i] === newMiddle[j]) {
      out.push(...interleave(block));
      block = [];
      i += 1;
      j += 1;
    } else if (j >= newMiddle.length || (i < oldMiddle.length && (table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0))) {
      block.push({ kind: "removed", line: head + i + 1, text: oldMiddle[i] ?? "" });
      i += 1;
    } else {
      block.push({ kind: "added", line: head + j + 1, text: newMiddle[j] ?? "" });
      j += 1;
    }
  }
  out.push(...interleave(block));
  return out;
}

/** A replaced line reads as its old version right above its new one. */
function interleave(block: readonly DiffLine[]): DiffLine[] {
  const removed = block.filter((line) => line.kind === "removed");
  const added = block.filter((line) => line.kind === "added");
  const out: DiffLine[] = [];
  for (let index = 0; index < Math.max(removed.length, added.length); index += 1) {
    const old = removed[index];
    const fresh = added[index];
    if (old !== undefined) out.push(old);
    if (fresh !== undefined) out.push(fresh);
  }
  return out;
}

/** How many lines of the text the change touches: a replaced line counts once. */
export function changedLineCount(diff: readonly DiffLine[]): number {
  const removed = diff.filter((line) => line.kind === "removed").length;
  const added = diff.length - removed;
  return Math.max(removed, added);
}
