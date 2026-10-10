// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Range } from "../diagnostics/diagnostics";

/** Physical lines of a source: offset to line and line to range. */
export class LineIndex {
  readonly #starts: readonly number[];
  readonly #source: string;

  constructor(source: string) {
    const starts = [0];
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] === "\n") starts.push(index + 1);
    }
    this.#starts = starts;
    this.#source = source;
  }

  /** 0-based line that contains the offset. */
  lineOf(offset: number): number {
    let low = 0;
    let high = this.#starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >>> 1;
      if ((this.#starts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return low;
  }

  /** 1-based line number, as shown to people. */
  lineNumber(offset: number): number {
    return this.lineOf(offset) + 1;
  }

  /** The line without its "\n" or "\r\n". */
  range(line: number): Range {
    const from = this.#starts[line] ?? this.#source.length;
    const next = this.#starts[line + 1];
    let to = next === undefined ? this.#source.length : next - 1;
    if (to > from && this.#source[to - 1] === "\r") to -= 1;
    return { from, to };
  }

  /** The line including its line break, for removing it whole. */
  rangeWithBreak(line: number): Range {
    const from = this.#starts[line] ?? this.#source.length;
    return { from, to: this.#starts[line + 1] ?? this.#source.length };
  }
}
