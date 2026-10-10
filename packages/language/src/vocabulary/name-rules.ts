// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { isWellFormedName } from "@untzel/core";

// What a track or section name may be. The shape is core's (names.ts); the words the
// grammar keeps for itself and the names already taken are the language's. Every edit
// that writes a name calls checkName, and the interface only anticipates it.

/**
 * Every kw<"…"> term of untzel.grammar. @extend lets the parser still read them as names
 * today (`square: square …`, which the library writes for the square instrument), but a
 * name the person picks never reads like a statement or a signal (`section`, `sine`), so a
 * rename refuses them. name-rules.test.ts compares this list with the grammar.
 */
export const RESERVED_WORDS: readonly string[] = [
  "title",
  "tempo",
  "key",
  "swing",
  "loop",
  "section",
  "song",
  "env",
  "sine",
  "tri",
  "saw",
  "square",
  "rand",
];

export type NameProblem = "INVALID_NAME" | "RESERVED_NAME" | "NAME_TAKEN";

/** Null when `name` can be written: well formed, not a word of the language, not in `taken`. */
export function checkName(name: string, taken: ReadonlySet<string>): NameProblem | null {
  if (!isWellFormedName(name)) return "INVALID_NAME";
  if (RESERVED_WORDS.includes(name)) return "RESERVED_NAME";
  return taken.has(name) ? "NAME_TAKEN" : null;
}
