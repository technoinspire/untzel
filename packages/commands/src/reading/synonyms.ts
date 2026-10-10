// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Vocabulary } from "./vocabulary";

// Lines that read like a command in another order: `gain kick 0.5` and `kick gain 0.5`
// mean `set kick gain 0.5`.
// Only a suggestion: the person runs it with Tab or a tap, nothing runs on its own.

/** The `set` line a parameter-first or track-first line means; null when it means neither. */
export function setLineFor(words: readonly string[], source: string, vocabulary: Vocabulary): string | null {
  const [first, second, ...rest] = words;
  if (first === undefined || second === undefined || rest.length === 0) return null;
  const tracks = vocabulary.names(source).tracks;
  const isParameterOf = (track: string, name: string): boolean => {
    const instrument = tracks.find((entry) => entry.name === track)?.instrument;
    return instrument !== undefined && vocabulary.parameter(instrument, name) !== undefined;
  };
  if (isParameterOf(first, second)) return ["set", first, second, ...rest].join(" ");
  if (isParameterOf(second, first)) return ["set", second, first, ...rest].join(" ");
  return null;
}
