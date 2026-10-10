// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { editDistance } from "@untzel/core";

// "Did you mean" for every unknown name: how far a
// suggestion may be, and whether replacing the word with it is a safe fix.

/** The closest name, and whether it is the only candidate that close. */
export interface Suggestion {
  readonly text: string;
  /** One candidate within reach: a typo of it. Two or more: a choice the person makes. */
  readonly safe: boolean;
}

/** max(1, ⌊length/3⌋); a one-character name gets no suggestion, it could be anything. */
export function suggestionReach(word: string): number {
  return word.length <= 1 ? 0 : Math.max(1, Math.floor(word.length / 3));
}

/** The closest candidate within reach, the first one on a tie; null when none. */
export function closest(word: string, candidates: Iterable<string>): Suggestion | null {
  const reach = suggestionReach(word);
  let best: string | null = null;
  let bestDistance = reach + 1;
  let near = 0;
  for (const candidate of new Set(candidates)) {
    const distance = editDistance(word, candidate);
    if (distance === 0 || distance > reach) continue;
    near += 1;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best === null ? null : { text: best, safe: near === 1 };
}

/** The text of the closest candidate within reach; null when none. */
export function suggest(word: string, candidates: Iterable<string>): string | null {
  return closest(word, candidates)?.text ?? null;
}
