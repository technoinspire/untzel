// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the export sheet asks for: the format, the quality, the range (Loop with its bars,
// Song with its parts, or the play range) and the mode. Pure, so the request and
// its key are tested without a worker. The key leaves the live position out on purpose:
// playing, the position moves every bar, and a key with it would lose a finished result
// one bar later (Export while the music plays).
import type { ExportFormat } from "@untzel/presentation/view-model";
import type { ExportQuality, ExportRange } from "@untzel/export";
import type { ExportStretch, PlaybackMode, PlayRange as SessionPlayRange } from "@untzel/session";

export interface PartRange {
  readonly from: number;
  readonly to: number;
}

/**
 * The play range as the export reads it: the transport's PlayRange, 1-based
 * and inclusive ("Bars 9–28"), without Cycle, which the export never repeats.
 */
export type PlayRange = Pick<SessionPlayRange, "startBar" | "endBar">;
/** The play range the sheet follows: its bars, the ruler they count on, and its words. */
export interface FollowedRange extends PlayRange {
  readonly mode: PlaybackMode;
  /** "Bars 9–28 · build → drop". */
  readonly label: string;
}
/** The same mode and bars, or both cleared: the sheet keeps its choice. */
export function isSameFollowedRange(current: FollowedRange | null, next: FollowedRange | null): boolean {
  if (current === null || next === null) return current === next;
  return current.mode === next.mode && current.startBar === next.startBar && current.endBar === next.endBar;
}

export type BarsChoice = 8 | 16 | 32 | 64;

/** The choices of the sheet's Bars select; anything else falls back to the default, 16. */
export function barsChoice(bars: number): BarsChoice {
  return bars === 8 || bars === 32 || bars === 64 ? bars : 16;
}

/** From and To in order, whichever the person picked first. */
export function orderedParts(range: PartRange): PartRange {
  return { from: Math.min(range.from, range.to), to: Math.max(range.from, range.to) };
}

/** The chosen parts within the song's parts; no choice means the whole song. */
export function partsWithin(range: PartRange | null, parts: number): PartRange {
  const last = Math.max(0, parts - 1);
  const chosen = range ?? { from: 0, to: last };
  return { from: Math.min(chosen.from, last), to: Math.min(chosen.to, last) };
}

export interface RangeRequest {
  readonly format: ExportFormat;
  /** Loop or Song, as the sheet has it. */
  readonly mode: PlaybackMode;
  readonly bars: number;
  readonly parts: PartRange;
  /** When chosen (Selected range), it is the range of every format, the story included. */
  readonly stretch: ExportStretch | null;
}

/** The stretch of music the plan renders: the play range, else none for the story, bars in loop, parts in song. */
export function exportRangeOf(request: RangeRequest): ExportRange | null {
  if (request.stretch !== null) return { kind: "span", startTick: request.stretch.startTick, endTick: request.stretch.endTick };
  if (request.format === "story") return null;
  if (request.mode !== "song") return { kind: "bars", bars: barsChoice(request.bars) };
  return { kind: "song", fromPart: request.parts.from, toPart: request.parts.to };
}

export interface KeyRequest {
  readonly sourceHash: number;
  readonly format: ExportFormat;
  readonly quality: ExportQuality;
  readonly mode: PlaybackMode;
  readonly range: ExportRange | null;
}

/** Only a new text, format, quality, mode or range changes the key; the live position never does. */
export function requestKey(request: KeyRequest): string {
  const { range } = request;
  const stretch =
    range === null
      ? "story"
      : range.kind === "bars"
        ? `bars ${range.bars}`
        : range.kind === "song"
          ? `parts ${range.fromPart}-${range.toPart}`
          : `span ${range.startTick}-${range.endTick}`;
  const quality = request.format === "audio" ? "wav" : request.quality;
  return `${request.sourceHash}|${request.format}|${quality}|${request.mode}|${stretch}`;
}
