// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The shape of every name the text and the manifests use: tracks, sections, instruments,
// parameters and sounds. One owner of the shape: the language and the manifest readers never
// disagree. What is reserved or taken is the language's business (language/name-rules.ts).

/** Track, section and manifest names: at most this many characters. */
export const NAME_MAX_LENGTH = 24;

const NAME_SHAPE = /^[a-z][a-z0-9_-]*$/;

/** A lower-case letter, then letters, digits, "-" or "_", at most 24 characters. */
export function isWellFormedName(name: string): boolean {
  return name.length <= NAME_MAX_LENGTH && NAME_SHAPE.test(name);
}
