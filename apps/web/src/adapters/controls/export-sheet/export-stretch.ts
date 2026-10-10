// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export sheet's stretch: a copy of the play range, or
// of the whole loop or song, that the sheet edits by steps without touching what plays.
// It lives on the ruler of one mode and one program: a new program cuts it to its ruler,
// a new ruler (another mode) copies it again. The rules (snap, cut, cap, clock) are the
// session's; this class keeps the state and hands the sheet its view.
import type { ExportStretchView } from "@untzel/presentation/view-model";
import { buildArrangement, type Program } from "@untzel/core";
import {
  clampStretch,
  exportTimeMap,
  lastBarOf,
  secondsAtTick,
  stretchOfPlayRange,
  stretchSeconds,
  trimStretchToCap,
  type ExportStretch,
  type PlaybackMode,
  type TimeMap,
} from "@untzel/session";

/** What the stretch copies: the play range of its ruler, or null for the whole ruler. */
export interface StretchSource {
  readonly mode: PlaybackMode;
  readonly range: { readonly startBar: number; readonly endBar: number } | null;
}

interface Ruler {
  readonly program: Program;
  readonly mode: PlaybackMode;
  readonly lastBar: number;
  readonly map: TimeMap;
  readonly parts: ExportStretchView["parts"];
}

export class ExportStretchState {
  #ruler: Ruler | null = null;
  #stretch: ExportStretch | null = null;
  #source: StretchSource | null = null;
  #isFine = false;
  /** Not edited since it was copied: it follows the cap of the format chosen now. */
  #isCopy = true;

  /**
   * The ruler of `source.mode` under `program`; a new source or ruler copies the source
   * again. A copy nobody edited follows the cap of the format chosen now (the line under
   * the ruler says the cap); an edit is cut only to a new ruler.
   */
  sync(program: Program | null, source: StretchSource, capSeconds: number): void {
    const isNewSource = !sameSource(this.#source, source);
    this.#source = source;
    if (program === null) {
      this.#ruler = null;
      return;
    }
    const ruler = this.#ruler;
    const isSameRuler = ruler !== null && ruler.program === program && ruler.mode === source.mode;
    const next = isSameRuler ? ruler : rulerOf(program, source.mode);
    this.#ruler = next;
    if (next === null) return;
    const isOtherRuler = ruler === null || ruler.mode !== next.mode || this.#stretch === null;
    if (isNewSource || isOtherRuler) this.#isCopy = true;
    if (this.#isCopy) this.#stretch = trimStretchToCap(this.#copy(next), next.map, capSeconds, this.#isFine).stretch;
    else if (!isSameRuler) this.#stretch = clampStretch(this.#stretch ?? this.#copy(next), next.lastBar);
  }

  /** The stretch as a format with this cap would take it, without changing it. */
  trimmedTo(capSeconds: number): ExportStretch | null {
    const ruler = this.#ruler;
    if (ruler === null || this.#stretch === null) return null;
    return trimStretchToCap(this.#stretch, ruler.map, capSeconds, this.#isFine).stretch;
  }

  /** "0:07.3"-ready seconds of a tick on this ruler. */
  secondsAt(tick: number): number {
    return this.#ruler === null ? 0 : secondsAtTick(this.#ruler.map, tick);
  }

  get stretch(): ExportStretch | null {
    return this.#ruler === null ? null : this.#stretch;
  }

  get mode(): PlaybackMode | null {
    return this.#ruler?.mode ?? null;
  }

  /** A stretch from the sheet: cut to the ruler, then to the cap. */
  set(stretch: ExportStretch, capSeconds: number): void {
    const ruler = this.#ruler;
    if (ruler === null) return;
    this.#stretch = trimStretchToCap(clampStretch(stretch, ruler.lastBar), ruler.map, capSeconds, this.#isFine).stretch;
    this.#isCopy = false;
  }

  /** A smaller cap (the Story, 4K): true when the end had to come back. */
  trim(capSeconds: number): boolean {
    const ruler = this.#ruler;
    if (ruler === null || this.#stretch === null) return false;
    const trimmed = trimStretchToCap(this.#stretch, ruler.map, capSeconds, this.#isFine);
    this.#stretch = trimmed.stretch;
    if (trimmed.isCapped) this.#isCopy = false;
    return trimmed.isCapped;
  }

  /** "Use play range": the copy again, trimmed to the cap. */
  reset(capSeconds: number): void {
    const ruler = this.#ruler;
    if (ruler === null) return;
    this.#stretch = trimStretchToCap(this.#copy(ruler), ruler.map, capSeconds, this.#isFine).stretch;
    this.#isCopy = true;
  }

  setFine(isFine: boolean): void {
    this.#isFine = isFine;
  }

  /** At the cap now: the length is the cap, give or take a 1/64 step. */
  isAtCap(capSeconds: number): boolean {
    const ruler = this.#ruler;
    if (ruler === null || this.#stretch === null) return false;
    return capSeconds - stretchSeconds(ruler.map, this.#stretch) < (ruler.map[0]?.secondsPerBar ?? 2) / 64;
  }

  /** `rangeLabel` is the play range's words; shown only while the stretch is that range, uncut. */
  view(capSeconds: number, rangeLabel: string | null): ExportStretchView | null {
    const ruler = this.#ruler;
    const stretch = this.#stretch;
    if (ruler === null || stretch === null) return null;
    const whole = this.#copy(ruler);
    const copy = trimStretchToCap(whole, ruler.map, capSeconds, this.#isFine).stretch;
    const isPlayRange = (this.#source?.range ?? null) !== null && sameStretch(whole, stretch);
    return {
      mode: ruler.mode,
      lastBar: ruler.lastBar,
      parts: ruler.parts,
      startTick: stretch.startTick,
      endTick: stretch.endTick,
      timeMap: ruler.map,
      capSeconds,
      isFine: this.#isFine,
      playheadBar: null,
      isListening: false,
      hasPlayRange: (this.#source?.range ?? null) !== null,
      isReset: sameStretch(copy, stretch),
      playRangeLabel: isPlayRange ? rangeLabel : null,
    };
  }

  #copy(ruler: Ruler): ExportStretch {
    return stretchOfPlayRange(this.#source?.range ?? null, ruler.lastBar);
  }
}

function rulerOf(program: Program, mode: PlaybackMode): Ruler | null {
  const arrangement = buildArrangement(program);
  const lastBar = lastBarOf(program, arrangement, mode);
  if (lastBar === null || lastBar < 1) return null;
  const parts = mode === "song" ? (arrangement?.parts ?? []).map((part) => ({ name: part.section.name, startBar: part.start + 1, endBar: part.start + part.bars })) : [];
  return { program, mode, lastBar, map: exportTimeMap(program, mode, arrangement), parts };
}

function sameStretch(a: ExportStretch, b: ExportStretch): boolean {
  return a.startTick === b.startTick && a.endTick === b.endTick;
}

function sameSource(a: StretchSource | null, b: StretchSource): boolean {
  if (a === null || a.mode !== b.mode) return false;
  if (a.range === null || b.range === null) return a.range === b.range;
  return a.range.startBar === b.range.startBar && a.range.endBar === b.range.endBar;
}
