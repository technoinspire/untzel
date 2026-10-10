// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/** Lines kept per session. */
export const COMMAND_HISTORY_LIMIT = 100;

/**
 * Up and Down through the lines run so far. Walking keeps what was being typed as the
 * newest entry, so Down past the last line gives it back.
 */
export class CommandHistory {
  readonly #lines: string[] = [];
  readonly #limit: number;
  /** Position while walking; lines.length means "the draft". */
  #cursor = 0;
  #draft = "";

  constructor(limit = COMMAND_HISTORY_LIMIT) {
    this.#limit = limit;
  }

  get size(): number {
    return this.#lines.length;
  }

  /** A line that ran; a repeat of the last one is kept once. */
  push(line: string): void {
    const trimmed = line.trim();
    if (trimmed !== "" && this.#lines.at(-1) !== trimmed) this.#lines.push(trimmed);
    if (this.#lines.length > this.#limit) this.#lines.splice(0, this.#lines.length - this.#limit);
    this.#cursor = this.#lines.length;
    this.#draft = "";
  }

  /** Up: the line before, or null at the oldest. `current` is what the field holds now. */
  previous(current: string): string | null {
    if (this.#cursor === 0) return null;
    if (this.#cursor === this.#lines.length) this.#draft = current;
    this.#cursor -= 1;
    return this.#lines[this.#cursor] ?? null;
  }

  /** Down: the line after, the draft after the newest, or null when already there. */
  next(): string | null {
    if (this.#cursor >= this.#lines.length) return null;
    this.#cursor += 1;
    return this.#cursor === this.#lines.length ? this.#draft : (this.#lines[this.#cursor] ?? null);
  }
}
