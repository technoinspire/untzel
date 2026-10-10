// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the export's stretch shows and how its handles move:
// the transport's ruler, by steps (1/16, or 1/64 with Fine), stopped at the format's cap;
// times as m:ss.s and positions as bar.beat. The snapping, the cap and the clock are the
// session's rules; this file only turns them into the ruler's words. Pure.
import {
  TICKS_PER_BAR,
  barBeatLabel,
  barBeatOf,
  moveStretchHandle,
  secondsAtTick,
  stretchKeyTick,
  type ExportStretch,
} from "@untzel/session/rules";
import type { ExportFormat, ExportQualityName, ExportStretchView } from "@untzel/presentation/view-model";
import { exportStretchPhrases, exportStretchStrings, rangeStrings } from "../../copy/copy";
import { clockLabel, exportCapNote } from "./export-stretch-words";
import { barNumbers, playheadFraction } from "../range/range-ruler-model";
import type { Edges, Handle, RulerScale, RulerView } from "../range/ruler-geometry";

const edgesOf = (stretch: ExportStretch): Edges => ({ start: stretch.startTick / TICKS_PER_BAR, end: stretch.endTick / TICKS_PER_BAR });
/** The ruler's edges, in bars, as the ticks the stretch is written in (the reverse of edgesOf). */
export function stretchTicksOf(edges: Edges): { readonly start: number; readonly end: number } {
  return { start: Math.round(edges.start * TICKS_PER_BAR), end: Math.round(edges.end * TICKS_PER_BAR) };
}
const tickOf = (view: ExportStretchView, handle: Handle): number => (handle === "start" ? view.startTick : view.endTick);
const word = (handle: Handle): string => (handle === "start" ? rangeStrings.start : rangeStrings.end);

function spoken(tick: number): string {
  const { bar, beat, step, fine } = barBeatOf(tick);
  return exportStretchPhrases.spokenPosition(bar, beat, step, fine);
}

/** The ruler of the export: the band always shows, the handles at the stretch's ends. */
export function exportRulerView(view: ExportStretchView): RulerView {
  const lastTick = view.lastBar * TICKS_PER_BAR;
  const span = { startBar: Math.floor(view.startTick / TICKS_PER_BAR) + 1, endBar: Math.ceil(view.endTick / TICKS_PER_BAR) };
  const handle = (which: Handle) => {
    const tick = tickOf(view, which);
    const range = which === "start" ? { min: 0, max: Math.max(0, view.endTick - TICKS_PER_BAR) } : { min: Math.min(lastTick, view.startTick + TICKS_PER_BAR), max: lastTick };
    return { ...range, now: tick, valueText: exportStretchPhrases.handleValue(word(which), clockLabel(secondsAtTick(view.timeMap, tick)), spoken(tick)) };
  };
  return {
    mode: view.mode,
    lastBar: view.lastBar,
    parts: view.parts,
    hasRange: true,
    edges: edgesOf(view),
    pending: null,
    playhead: playheadFraction(view.playheadBar, view.lastBar),
    editingBars: [],
    numbers: barNumbers(view.mode, view.lastBar, span, view.parts),
    handles: { start: handle("start"), end: handle("end") },
    isInert: view.lastBar <= 1,
  };
}

/** The export's handles: a drag snaps to the step (Fine, Shift or Alt: 1/64); keys step, Shift a bar. */
export function exportScale(view: ExportStretchView): RulerScale {
  const limits = (isFine: boolean) => ({ lastBar: view.lastBar, map: view.timeMap, capSeconds: view.capSeconds, isFine: view.isFine || isFine });
  return {
    drag: (handle, at, isFine) => edgesOf(moveStretchHandle(view, handle, at * TICKS_PER_BAR, limits(isFine)).stretch),
    key: (handle, key, shift) => {
      const target = stretchKeyTick(key, shift, tickOf(view, handle), view.isFine, view.lastBar);
      // The key already lands on a line: moved at 1/64 so it is not snapped again.
      return target === null ? null : edgesOf(moveStretchHandle(view, handle, target, limits(true)).stretch);
    },
    dragLabel: (handle, edges) => {
      const tick = Math.round((handle === "start" ? edges.start : edges.end) * TICKS_PER_BAR);
      return exportStretchPhrases.dragLabel(word(handle), clockLabel(secondsAtTick(view.timeMap, tick)), barBeatLabel(tick));
    },
  };
}

export interface ExportStretchState {
  /** "0:07.3 · bar 3.2 → 0:21.8 · bar 7.1". */
  readonly readout: string;
  /** "Story up to 1:00": why a handle stops where it does. */
  readonly capNote: string;
  readonly resetLabel: string;
  readonly isResetInert: boolean;
}

export function exportStretchState(view: ExportStretchView, format: ExportFormat, quality: ExportQualityName): ExportStretchState {
  const at = (tick: number): string => clockLabel(secondsAtTick(view.timeMap, tick));
  const whole = view.mode === "loop" ? exportStretchStrings.useWholeLoop : exportStretchStrings.useWholeSong;
  return {
    readout: exportStretchPhrases.readout(at(view.startTick), barBeatLabel(view.startTick), at(view.endTick), barBeatLabel(view.endTick)),
    capNote: exportCapNote(format, quality, view.capSeconds),
    resetLabel: view.hasPlayRange ? exportStretchStrings.usePlayRange : whole,
    isResetInert: view.isReset,
  };
}
