// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range and the song's parts: a part → its range, extending to a
// part, and the names the transport label uses. Pure, over core's Arrangement.
import type { Arrangement } from "@untzel/core";
import type { PlayRange } from "./play-range";

/** The bars of one part, 1-based and inclusive; null for an index outside the song. */
export function rangeOfPart(arrangement: Arrangement, partIndex: number, cycle: boolean): PlayRange | null {
  const part = arrangement.parts[partIndex];
  if (part === undefined || !Number.isInteger(partIndex)) return null;
  return { startBar: part.start + 1, endBar: part.start + part.bars, cycle };
}

/** To here: the range grows, before or after, to cover the part; without a range it is the part. */
export function extendRangeToPart(range: PlayRange | null, arrangement: Arrangement, partIndex: number): PlayRange | null {
  const part = rangeOfPart(arrangement, partIndex, range?.cycle ?? true);
  if (part === null || range === null) return part;
  return { startBar: Math.min(range.startBar, part.startBar), endBar: Math.max(range.endBar, part.endBar), cycle: range.cycle };
}

/** True when the range is exactly that part: its Play button shows pressed. */
export function isRangeOfPart(range: PlayRange | null, arrangement: Arrangement, partIndex: number): boolean {
  const part = rangeOfPart(arrangement, partIndex, true);
  return range !== null && part !== null && range.startBar === part.startBar && range.endBar === part.endBar;
}

export interface RangePartNames {
  readonly first: string;
  readonly last: string;
  /** One of the two names is used by more than one part: the label adds the bars. */
  readonly repeated: boolean;
  /** The range is a single part. */
  readonly single: boolean;
}

/** The parts at the ends when both ends fall on part boundaries; null otherwise. */
export function rangePartNames(range: PlayRange, arrangement: Arrangement): RangePartNames | null {
  const first = arrangement.parts.findIndex((part) => part.start + 1 === range.startBar);
  const last = arrangement.parts.findIndex((part) => part.start + part.bars === range.endBar);
  const firstPart = arrangement.parts[first];
  const lastPart = arrangement.parts[last];
  if (firstPart === undefined || lastPart === undefined || last < first) return null;
  const uses = (name: string) => arrangement.parts.filter((part) => part.section.name === name).length;
  const repeated = uses(firstPart.section.name) > 1 || uses(lastPart.section.name) > 1;
  return { first: firstPart.section.name, last: lastPart.section.name, repeated, single: first === last };
}

/** The part a ruler bar (1-based) falls in, for "From build: tap the end part". */
export function partIndexAtBar(arrangement: Arrangement, bar: number): number | null {
  const index = arrangement.parts.findIndex((part) => bar > part.start && bar <= part.start + part.bars);
  return index < 0 ? null : index;
}
