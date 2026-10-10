// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export ruler's clock: seconds along the loop or the song, from the same
// tempos the transport plays (core's originAtBar: the loop section's tempo, or each part's
// in a song). Pure.
import { buildArrangement, loopSectionOf, toNumber, type Arrangement, type Program } from "@untzel/core";
import type { TimeMap, TimeSegment } from "./export-stretch";
import type { PlaybackMode } from "../types";

const QUARTERS_PER_BAR_SECONDS = 240;

export function exportTimeMap(program: Program, mode: PlaybackMode, arrangement: Arrangement | null = buildArrangement(program)): TimeMap {
  if (mode === "loop" || arrangement === null) {
    const tempo = mode === "loop" ? (loopSectionOf(program)?.tempo ?? program.tempo) : program.tempo;
    return [{ startBar: 0, startSeconds: 0, secondsPerBar: QUARTERS_PER_BAR_SECONDS / toNumber(tempo) }];
  }
  const segments: TimeSegment[] = [];
  let seconds = 0;
  for (const part of arrangement.parts) {
    const secondsPerBar = QUARTERS_PER_BAR_SECONDS / toNumber(part.section.tempo ?? program.tempo);
    const previous = segments.at(-1);
    if (previous === undefined || previous.secondsPerBar !== secondsPerBar) segments.push({ startBar: part.start, startSeconds: seconds, secondsPerBar });
    seconds += part.bars * secondsPerBar;
  }
  return segments;
}
