// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range on the Song view's rows (a Play on
// every row): where each part stands against the range, which buttons it offers and their
// names, the list's hint and the part editor's Play from here note. Pure.
import type { PlayRangeValue, PlayRangeView, SongPartView } from "@untzel/presentation/view-model";
import { rangePhrases, rangeStrings } from "../../copy/copy";

export type PartRangeRole = "none" | "outside" | "start" | "end" | "both" | "inside";

export interface PartRangeState {
  readonly role: PartRangeRole;
  /** "Start · bar 9", "End · bar 28", "In range", "bars 13–28"; text, never a target. */
  readonly text: string | null;
  /** To here: only on rows outside a range. */
  readonly canExtend: boolean;
  readonly setLabel: string;
  readonly extendLabel: string;
  readonly playLabel: string;
  /** The range is exactly this part: its Play shows pressed, and a tap clears the range. */
  readonly isPlayPressed: boolean;
}

export function partRangeStates(parts: readonly SongPartView[], range: PlayRangeValue | null): readonly PartRangeState[] {
  return parts.map((part) => {
    const first = part.start + 1;
    const last = part.start + part.bars;
    const role = roleOf(first, last, range);
    return {
      role,
      text: textOf(role, range),
      canExtend: role === "outside",
      setLabel: rangePhrases.setRangeToPart(part.section),
      extendLabel: rangePhrases.extendRangeTo(part.section),
      playLabel: rangePhrases.playPartOnly(part.section),
      isPlayPressed: range !== null && range.startBar === first && range.endBar === last,
    };
  });
}

function roleOf(first: number, last: number, range: PlayRangeValue | null): PartRangeRole {
  if (range === null) return "none";
  if (last < range.startBar || first > range.endBar) return "outside";
  const hasStart = range.startBar >= first && range.startBar <= last;
  const hasEnd = range.endBar >= first && range.endBar <= last;
  if (hasStart && hasEnd) return "both";
  if (hasStart) return "start";
  return hasEnd ? "end" : "inside";
}

function textOf(role: PartRangeRole, range: PlayRangeValue | null): string | null {
  if (range === null) return null;
  switch (role) {
    case "start":
      return rangePhrases.handleLabel(rangeStrings.start, range.startBar);
    case "end":
      return rangePhrases.handleLabel(rangeStrings.end, range.endBar);
    case "both":
      return rangePhrases.bars(range.startBar, range.endBar);
    case "inside":
      return rangeStrings.inRange;
    default:
      return null;
  }
}

/** The list's hint after the bracket icon, and what a screen reader hears instead. */
export function listHint(hasRange: boolean): { readonly visible: string; readonly accessible: string } {
  return hasRange
    ? { visible: rangeStrings.listHintVisible, accessible: rangeStrings.listHintAccessible }
    : { visible: rangeStrings.listHintNoRange, accessible: rangeStrings.listHintNoRangeAccessible };
}

/**
 * The part editor's note for this part: the song's range when the ruler is the song's;
 * with the loop's ruler there is no song range yet, and the song ends at its last part.
 */
export function partPlayFromNote(playRange: Pick<PlayRangeView, "mode" | "range" | "lastBar">, parts: readonly SongPartView[], part: SongPartView): string {
  if (playRange.mode === "song") return playFromNote(playRange.range, part, playRange.lastBar);
  const last = parts.at(-1);
  return playFromNote(null, part, last === undefined ? 0 : last.start + last.bars);
}

/** What Play from here does on this part, in the part editor. */
export function playFromNote(range: PlayRangeValue | null, part: SongPartView, lastBar: number): string {
  const first = part.start + 1;
  if (range === null) return rangePhrases.playFromNoteSong(first);
  if (first <= range.endBar) return rangePhrases.playFromNoteMoves(first);
  return rangePhrases.playFromNoteBars(first, lastBar);
}
