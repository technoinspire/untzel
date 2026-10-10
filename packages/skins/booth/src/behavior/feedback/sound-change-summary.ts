// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { LibraryEntryView, TrackView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";

// What Change sound keeps and drops: the pattern and the mix always
// stay; a written instrument parameter stays when the new instrument has it. Kept notes
// may fall outside the new instrument's range, which the language allows, so it is said.

function list(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${strings.and} ${names.at(-1) ?? ""}`;
}

/** "Keeps the pattern, cutoff and the mix. Drops drive. Some notes are below pluck's range." */
export function soundChangeSummary(track: TrackView, next: LibraryEntryView): string {
  const kept = track.writtenParameters.filter((name) => next.parameters.includes(name));
  const dropped = track.writtenParameters.filter((name) => !next.parameters.includes(name));
  const sentences = [strings.keeps(list([strings.thePattern, ...kept, strings.theMix]))];
  if (dropped.length > 0) sentences.push(strings.drops(list(dropped)));
  const span = track.noteSpan;
  const range = next.range;
  if (span !== null && range !== null) {
    if (span.lowest < range.lowest) sentences.push(strings.notesBelowRange(next.instrument));
    if (span.highest > range.highest) sentences.push(strings.notesAboveRange(next.instrument));
  }
  return sentences.join(" ");
}
