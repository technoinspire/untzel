// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The transport's words with a play range:
// the full text is the desktop position line and every accessible name; under
// 1200 px the first line drops words, in a fixed order, until it fits. Pure.
import type { PlayRangeView, RangePartNames, TransportView } from "@untzel/presentation/view-model";
import { phrases, rangePhrases, strings } from "../../copy/copy";

/** About 150 px of the phone's first line at 13 px, measured on a16 (9 situations, 2 stresses). */
export const PHONE_LINE_CHARS = 21;
/** The desktop's live column at 1200–1280 px with a panel open: the line shares ~110 px with CPU. */
export const NARROW_LINE_CHARS = 14;

export interface TransportLines {
  /** "Song · build → drop · bars 9–28 · bar 17 of 56". */
  readonly full: string;
  /** The first line under 1200 px: "bars 9–28 · bar 17". */
  readonly short: string;
  /** A narrow desktop column, beside CPU: "bar 2 of 16". */
  readonly narrow: string;
}

/** A piece of the line in its long and shorter forms, so the phone can drop words in any language. */
interface Bars {
  /** "bars 3–6 of 8" (loop) or "bars 9–28" (song). */
  readonly long: string;
  /** "bars 3–6". */
  readonly mid: string;
  /** "3–6". */
  readonly bare: string;
}
interface Position {
  /** "bar 17 of 56". */
  readonly long: string;
  /** "bar 17". */
  readonly short: string;
}
interface Pieces {
  readonly mode: string;
  /** "build → drop", "drop", "from build, bar 9": dropped by step (b) when bars say the same. */
  readonly names: string | null;
  /** What remains of `names` after (b): "from bar 9" with Cycle off, else nothing. */
  readonly namesWithout: string | null;
  readonly bars: Bars | null;
  readonly position: Position | null;
}

export function transportLines(transport: TransportView, range: Pick<PlayRangeView, "sounding" | "parts" | "songNames">): TransportLines {
  const { mode, names, namesWithout, bars, position } = transport.mode === "loop" ? loopPieces(transport, range.sounding) : songPieces(transport, range);
  const full = join([mode, names, bars?.long, position?.long]);
  const withoutMode = join([names, bars?.long, position?.long]);
  const hasNamesToDrop = names !== null && (bars !== null || namesWithout !== null);
  const kept = hasNamesToDrop ? namesWithout : names;
  const withoutNames = join([kept, bars?.long, position?.long]);
  const withoutTotals = join([kept, bars?.mid, position?.short]);
  const withoutBarsWord = join([kept, bars?.bare, position?.short]);
  const candidates = [full, withoutMode, withoutNames, withoutTotals, withoutBarsWord];
  const fitting = (chars: number): string => candidates.find((candidate) => candidate.length <= chars) ?? withoutBarsWord;
  return { full, short: fitting(PHONE_LINE_CHARS), narrow: fitting(NARROW_LINE_CHARS) };
}

/** "build → drop", or "drop" for a range of one part. */
export function partSpanNames(named: Pick<RangePartNames, "first" | "last" | "single">): string {
  return named.single ? named.first : `${named.first} → ${named.last}`;
}

function rangeBars(start: number, end: number, total: number | null): Bars {
  const mid = rangePhrases.bars(start, end);
  return { long: total === null ? mid : rangePhrases.barsOf(start, end, total), mid, bare: rangePhrases.barNumbers(start, end) };
}

function loopPieces(transport: TransportView, range: PlayRangeView["sounding"]): Pieces {
  const bars = transport.loopBarsSounding ?? transport.loopBars;
  const playing = transport.loopBar;
  if (range === null) {
    const whole = playing === null ? phrases.bars(bars) : phrases.barOf(playing, bars);
    return { mode: strings.loop, names: null, namesWithout: null, bars: null, position: { long: whole, short: playing === null ? whole : strings.barAt(playing) } };
  }
  const position = playing === null ? null : { long: strings.barAt(playing), short: strings.barAt(playing) };
  return { mode: strings.loop, names: null, namesWithout: null, bars: rangeBars(range.startBar, range.endBar, bars), position };
}

function songPieces(transport: TransportView, view: Pick<PlayRangeView, "sounding" | "parts" | "songNames">): Pieces {
  const range = view.sounding;
  const bar = transport.bar;
  const position = bar === null ? null : { long: transport.totalBars === null ? strings.barAt(bar) : phrases.barOf(bar, transport.totalBars), short: strings.barAt(bar) };
  if (range === null) return { mode: strings.song, names: transport.section, namesWithout: null, bars: null, position };
  if (!range.cycle) {
    const part = view.parts.find((entry) => entry.startBar === range.startBar)?.name ?? null;
    return { mode: strings.song, names: rangePhrases.fromStart(part, range.startBar), namesWithout: part === null ? null : rangePhrases.fromBar(range.startBar), bars: null, position };
  }
  const named = view.songNames;
  const bars = rangeBars(range.startBar, range.endBar, null);
  if (named === null) return { mode: strings.song, names: null, namesWithout: null, bars, position };
  const needsBars = named.single || named.repeated;
  return { mode: strings.song, names: partSpanNames(named), namesWithout: null, bars: needsBars ? bars : null, position };
}

function join(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(" · ");
}

/** "build → drop, bars 9–28" or "bars 10–28", for the Cycle sentence. */
export function rangeStretch(view: Pick<PlayRangeView, "range" | "songNames" | "mode">): string | null {
  const range = view.range;
  if (range === null) return null;
  const named = view.mode === "song" ? view.songNames : null;
  const names = named === null ? null : partSpanNames(named);
  return rangePhrases.stretch(names, range.startBar, range.endBar);
}

/** "build, bar 9" or "bar 10": where a Cycle-off song range starts. */
export function rangeFrom(view: Pick<PlayRangeView, "range" | "parts">): string | null {
  const range = view.range;
  if (range === null) return null;
  const part = view.parts.find((entry) => entry.startBar === range.startBar) ?? null;
  return rangePhrases.from(part?.name ?? null, range.startBar);
}
