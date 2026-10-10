// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { TrackView, TransportView } from "@untzel/presentation/view-model";
import { phrases } from "../../copy/copy";

// What each bar thumbnail and the bar actions show.
// Editing and playing are two separate facts: a ring for the bar being edited, a
// marker for the bar that sounds. A third one: whether the bar
// sounds at all, because a written loop shorter than the pattern ('loop 2' over a 4-bar
// kick) starts the pattern again every pass. Pure, tested without the DOM.

export interface BarThumbState {
  readonly name: string;
  readonly label: string;
  readonly isEditing: boolean;
  readonly isPlaying: boolean;
  /** False past the end of a shorter written loop: the bar never plays. */
  readonly isAudible: boolean;
}

/**
 * How many bars of a pattern play. The transport restarts the pattern on every pass of a
 * written loop, so in loop mode it is the shorter of the two; in song mode every bar.
 */
export function audibleBars(bars: number, transport: Pick<TransportView, "mode" | "loopBars" | "loopBarsSounding">): number {
  if (transport.mode !== "loop") return bars;
  return Math.min(bars, transport.loopBarsSounding ?? transport.loopBars);
}

export function barThumbStates(track: Pick<TrackView, "bars" | "playingBar">, editing: number, audible = track.bars): readonly BarThumbState[] {
  return Array.from({ length: track.bars }, (_, index) => ({
    name: index < audible ? phrases.barName(index + 1) : phrases.barNotInLoop(index + 1),
    label: index === editing ? phrases.thumbEditing(index + 1) : String(index + 1),
    isEditing: index === editing,
    isPlaying: index === track.playingBar,
    isAudible: index < audible,
  }));
}

/** "Loop plays bars 1–2 only" under the thumbnails; null when every bar plays. */
export function loopReachNote(bars: number, audible: number): string | null {
  return audible < bars ? phrases.loopPlaysBars(audible) : null;
}

/** What Copy bar took: the track, the bar and the kind of steps it holds. */
export interface CopiedBar {
  readonly track: string;
  readonly bar: number;
  readonly kind: TrackView["kind"];
}

/** Paste here needs a copy of the same kind of steps (drums into drums), and another bar. */
export function canPasteBar(copied: CopiedBar | null, track: Pick<TrackView, "name" | "kind">, bar: number): boolean {
  if (copied === null || copied.kind !== track.kind) return false;
  return !(copied.track === track.name && copied.bar === bar);
}
