// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's stretch: the same ruler as the play range,
// but finer than a bar, because a video may start on any step. Positions are ticks of
// 1/64 of a 4/4 bar, 0-based from the ruler's left edge; a stretch is half-open. Handles
// snap to the step grid (1/16) or, with Fine, to 1/64. A stretch is never shorter than one
// bar and never longer than its format's cap. Pure, tested without a clock; types only
// besides the rules, so the controls reach them through the session's rules subpath.
import type { PlayRange } from "../play-range/play-range";

export const TICKS_PER_BAR = 64;
export const TICKS_PER_BEAT = 16;
/** A 1/16 note: the step grid the handles snap to. */
export const TICKS_PER_STEP = 4;
/** Fine: a 1/64 note. */
export const FINE_TICKS = 1;
/** A stretch shorter than one bar is not allowed. */
export const MIN_STRETCH_TICKS = TICKS_PER_BAR;

/** Ticks from the ruler's left edge: [startTick, endTick). */
export interface ExportStretch {
  readonly startTick: number;
  readonly endTick: number;
}
export type StretchHandle = "start" | "end";

/** A stretch of the ruler at one tempo: from `startBar` (0-based), `startSeconds` in. */
export interface TimeSegment {
  readonly startBar: number;
  readonly startSeconds: number;
  readonly secondsPerBar: number;
}
/** The ruler's clock: one segment in a loop, one per tempo change in a song; sorted, the first at bar 0. */
export type TimeMap = readonly TimeSegment[];

/** What a handle may do: the ruler's end, the clock and the format's cap. */
export interface StretchLimits {
  readonly lastBar: number;
  readonly map: TimeMap;
  readonly capSeconds: number;
  readonly isFine: boolean;
}

export interface StretchResult {
  readonly stretch: ExportStretch;
  /** The cap stopped the moved handle (or trimmed the end). */
  readonly isCapped: boolean;
}

export function gridTicks(isFine: boolean): number {
  return isFine ? FINE_TICKS : TICKS_PER_STEP;
}

/** The play range "Bars 9–28" is ticks 512–1792; without one, the whole ruler. */
export function stretchOfPlayRange(range: Pick<PlayRange, "startBar" | "endBar"> | null, lastBar: number): ExportStretch {
  const last = Math.max(1, Math.floor(lastBar));
  if (range === null) return { startTick: 0, endTick: last * TICKS_PER_BAR };
  const endBar = Math.min(Math.max(range.endBar, 1), last);
  const startBar = Math.min(Math.max(range.startBar, 1), endBar);
  return { startTick: (startBar - 1) * TICKS_PER_BAR, endTick: endBar * TICKS_PER_BAR };
}

/** The nearest grid line to a tick (ties go up). */
export function snapTick(tick: number, isFine: boolean): number {
  const grid = gridTicks(isFine);
  return Math.round(tick / grid) * grid;
}

/** Seconds from the ruler's left edge to `tick`. */
export function secondsAtTick(map: TimeMap, tick: number): number {
  const bar = tick / TICKS_PER_BAR;
  const segment = segmentAt(map, (entry) => entry.startBar <= bar);
  return segment.startSeconds + (bar - segment.startBar) * segment.secondsPerBar;
}

/** The tick (fractional) at `seconds` from the ruler's left edge. */
export function tickAtSeconds(map: TimeMap, seconds: number): number {
  const segment = segmentAt(map, (entry) => entry.startSeconds <= seconds);
  return (segment.startBar + (seconds - segment.startSeconds) / segment.secondsPerBar) * TICKS_PER_BAR;
}

export function stretchSeconds(map: TimeMap, stretch: ExportStretch): number {
  return secondsAtTick(map, stretch.endTick) - secondsAtTick(map, stretch.startTick);
}

/** The ruler cut: both ends inside it, at least one bar long (a short ruler is taken whole). */
export function clampStretch(stretch: ExportStretch, lastBar: number): ExportStretch {
  const lastTick = Math.max(1, Math.floor(lastBar)) * TICKS_PER_BAR;
  const endTick = Math.min(Math.max(stretch.endTick, MIN_STRETCH_TICKS), lastTick);
  const startTick = Math.min(Math.max(stretch.startTick, 0), Math.max(0, endTick - MIN_STRETCH_TICKS));
  return startTick === stretch.startTick && endTick === stretch.endTick ? stretch : { startTick, endTick };
}

/**
 * A handle moved to `tick`: snapped to the grid, kept inside the ruler and a bar away
 * from the other handle, and stopped where the stretch reaches the cap.
 */
export function moveStretchHandle(stretch: ExportStretch, handle: StretchHandle, tick: number, limits: StretchLimits): StretchResult {
  const lastTick = Math.max(1, Math.floor(limits.lastBar)) * TICKS_PER_BAR;
  const snapped = snapTick(tick, limits.isFine);
  if (handle === "start") {
    const latest = Math.max(0, stretch.endTick - MIN_STRETCH_TICKS);
    const earliest = ceilToGrid(tickAtSeconds(limits.map, secondsAtTick(limits.map, stretch.endTick) - limits.capSeconds), limits.isFine);
    const wanted = Math.min(Math.max(snapped, 0), latest);
    const startTick = Math.min(Math.max(wanted, earliest), latest);
    return { stretch: { startTick, endTick: stretch.endTick }, isCapped: wanted < earliest };
  }
  const earliest = Math.min(stretch.startTick + MIN_STRETCH_TICKS, lastTick);
  const latest = Math.min(lastTick, floorToGrid(tickAtSeconds(limits.map, secondsAtTick(limits.map, stretch.startTick) + limits.capSeconds), limits.isFine));
  const wanted = Math.min(Math.max(snapped, earliest), lastTick);
  const endTick = Math.max(Math.min(wanted, latest), earliest);
  return { stretch: { startTick: stretch.startTick, endTick }, isCapped: wanted > latest };
}

/** Arrows one step (1/64 with Fine), Shift one bar, PageUp and PageDown one bar, Home and End to the limit. */
export function stretchKeyTick(key: string, shift: boolean, tick: number, isFine: boolean, lastBar: number): number | null {
  const step = shift ? TICKS_PER_BAR : gridTicks(isFine);
  const lastTick = Math.max(1, Math.floor(lastBar)) * TICKS_PER_BAR;
  const targets: Record<string, number> = {
    ArrowLeft: tick - step,
    ArrowDown: tick - step,
    ArrowRight: tick + step,
    ArrowUp: tick + step,
    PageDown: tick - TICKS_PER_BAR,
    PageUp: tick + TICKS_PER_BAR,
    Home: 0,
    End: lastTick,
  };
  const target = targets[key];
  if (target === undefined) return null;
  // A key from an off-grid tick lands on the grid line in its direction, never past it.
  if (key === "Home" || key === "End" || shift) return target;
  const grid = gridTicks(isFine);
  const isOff = tick % grid !== 0;
  if (!isOff) return target;
  return target > tick ? Math.ceil(tick / grid) * grid : Math.floor(tick / grid) * grid;
}

/** A smaller cap (Story, 4K): the end comes back to it. */
export function trimStretchToCap(stretch: ExportStretch, map: TimeMap, capSeconds: number, isFine: boolean): StretchResult {
  if (stretchSeconds(map, stretch) <= capSeconds) return { stretch, isCapped: false };
  const cut = floorToGrid(tickAtSeconds(map, secondsAtTick(map, stretch.startTick) + capSeconds), isFine);
  return { stretch: { startTick: stretch.startTick, endTick: Math.max(cut, stretch.startTick + MIN_STRETCH_TICKS) }, isCapped: true };
}

/** Bar, beat and step of a tick, 1-based, and the 1/64 left over: tick 168 is 3.3.3. */
export interface BarBeat {
  readonly bar: number;
  readonly beat: number;
  readonly step: number;
  readonly fine: number;
}
export function barBeatOf(tick: number): BarBeat {
  const whole = Math.max(0, Math.round(tick));
  return {
    bar: Math.floor(whole / TICKS_PER_BAR) + 1,
    beat: Math.floor((whole % TICKS_PER_BAR) / TICKS_PER_BEAT) + 1,
    step: Math.floor((whole % TICKS_PER_BEAT) / TICKS_PER_STEP) + 1,
    fine: whole % TICKS_PER_STEP,
  };
}

/** "3.2" on a beat, "3.2.3" on a step, "3.2.3+1/64" between steps. */
export function barBeatLabel(tick: number): string {
  const { bar, beat, step, fine } = barBeatOf(tick);
  const onBeat = step === 1 && fine === 0;
  const base = onBeat ? `${bar}.${beat}` : `${bar}.${beat}.${step}`;
  return fine === 0 ? base : `${base}+${fine}/64`;
}

function segmentAt(map: TimeMap, isBefore: (segment: TimeSegment) => boolean): TimeSegment {
  let found = map[0] ?? { startBar: 0, startSeconds: 0, secondsPerBar: 2 };
  for (const segment of map) if (isBefore(segment)) found = segment;
  return found;
}

/** A hair under the grid line counts as on it: seconds → ticks goes through floats. */
const EPSILON = 1e-6;
function floorToGrid(tick: number, isFine: boolean): number {
  const grid = gridTicks(isFine);
  return Math.floor(tick / grid + EPSILON) * grid;
}
function ceilToGrid(tick: number, isFine: boolean): number {
  const grid = gridTicks(isFine);
  return Math.ceil(tick / grid - EPSILON) * grid;
}
