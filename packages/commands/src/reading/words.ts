// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// A command line is words separated by blanks; nothing is ever evaluated.

/** A command line longer than this is refused before it is read. */
export const MAX_LINE_LENGTH = 512;

export interface Word {
  readonly text: string;
  /** Offsets in the line. */
  readonly from: number;
  readonly to: number;
}

export function splitWords(line: string): readonly Word[] {
  const words: Word[] = [];
  for (const match of line.matchAll(/\S+/g)) {
    words.push({ text: match[0], from: match.index, to: match.index + match[0].length });
  }
  return words;
}

/** The line with one word replaced: how every "Did you mean" line is built. */
export function replaceWord(line: string, word: Word, replacement: string): string {
  return `${line.slice(0, word.from)}${replacement}${line.slice(word.to)}`.trim();
}

/** "300", "-0.3", "1.5": the number forms the language reads. */
export function readNumber(text: string): number | null {
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
}
