// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Where the sound is now, extrapolated from the transport's latest report and the frame
// the context renders. A leaf: every presenter may import it. Pure.
import type { PlaybackPosition, SessionView } from "@untzel/session";
export const DEFAULT_BPM = 132;
const SECONDS_PER_BAR_AT_ONE_BPM = 240;
/** Bar position from the latest report: whole bars since play and the fraction of this one. */
export function barPosition(
  position: PlaybackPosition,
  bpm: number,
  nowFrame: number | null,
  sampleRate: number,
): { readonly bar: number; readonly fraction: number } {
  if (nowFrame === null || sampleRate <= 0 || bpm <= 0) return { bar: position.bar, fraction: 0 };
  const barFrames = (SECONDS_PER_BAR_AT_ONE_BPM * sampleRate) / bpm;
  const elapsed = (nowFrame - position.frame) / barFrames;
  const whole = Math.floor(elapsed);
  return { bar: Math.max(0, position.bar + whole), fraction: elapsed - whole };
}
/** Non-negative remainder: bar -1 of a 4-bar loop is its bar 3. */
export function wrap(value: number, length: number): number {
  return ((value % length) + length) % length;
}
/** Where the sound is now, extrapolated from the latest report; null when stopped. */
export interface Now {
  /** Bar the patterns read now (PlaybackPosition.patternBar plus the bars since). */
  readonly patternBar: number;
  /** Whole bars since the report. */
  readonly elapsed: number;
  readonly fraction: number;
  readonly bar: number;
}
export function nowOf(view: SessionView, nowFrame: number | null, sampleRate: number): Now | null {
  const position = view.position;
  if (position === null) return null;
  const { bar, fraction } = barPosition(position, view.tempo ?? DEFAULT_BPM, nowFrame, sampleRate);
  const elapsed = bar - position.bar;
  return { patternBar: position.patternBar + elapsed, elapsed, fraction, bar };
}
