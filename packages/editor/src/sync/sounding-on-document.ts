// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { TextRange } from "../ports";
import { textDiff } from "./session-sync";

// The sounding tokens on the document the person sees. They come in offsets of
// the program that plays, the last valid text; while the document is invalid or still
// being typed, the two differ, and an offset used as is lights the wrong character.

/**
 * `ranges` (offsets of `programSource`) moved onto `document` by the difference between
 * the two texts. A range the edit touches is dropped: what it pointed at was rewritten.
 */
export function soundingOnDocument(ranges: readonly TextRange[], programSource: string, document: string): readonly TextRange[] {
  if (programSource === document || ranges.length === 0) return ranges;
  const changes = textDiff(programSource, document);
  return ranges.flatMap((range) => {
    if (range.to > programSource.length || changes.touchesRange(range.from, range.to) !== false) return [];
    return [{ from: changes.mapPos(range.from, 1), to: changes.mapPos(range.to, -1) }];
  });
}
