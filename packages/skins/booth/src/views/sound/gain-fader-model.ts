// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { UNITY_POSITION, dbToPosition } from "@untzel/core";
import { strings } from "../../copy/copy";

// The gain fader's presentation: its marks, its legend and how a
// gesture moves it. The law itself (position ↔ dB ↔ gain) is core's fader-law.ts; the
// label in dB comes ready from the adapter, so no view computes a level.

export interface FaderMark {
  readonly label: string;
  readonly position: number;
  /** The 0 dB mark: a long white tick and a bold label. */
  readonly isUnity: boolean;
  /** Shown only where there is room (the desktop panel). */
  readonly isWideOnly: boolean;
}

const MINUS = "\u2212";

export const GAIN_MARKS: readonly FaderMark[] = [
  { label: "Off", position: 0, isUnity: false, isWideOnly: false },
  { label: `${MINUS}40`, position: dbToPosition(-40), isUnity: false, isWideOnly: false },
  { label: `${MINUS}20`, position: dbToPosition(-20), isUnity: false, isWideOnly: false },
  { label: `${MINUS}10`, position: dbToPosition(-10), isUnity: false, isWideOnly: false },
  { label: `${MINUS}6`, position: dbToPosition(-6), isUnity: false, isWideOnly: true },
  { label: "0 dB", position: UNITY_POSITION, isUnity: true, isWideOnly: false },
  { label: "+6", position: 1, isUnity: false, isWideOnly: false },
];

/** Shift or Alt dragging moves the thumb a quarter of the pointer: fine steps. */
export const FINE_FACTOR = 0.25;
/** Two taps closer than this are a double tap (touch has no dblclick). */
export const DOUBLE_TAP_MS = 300;

export function faderLegend(isTouch: boolean): string {
  return isTouch ? strings.faderTouchLegend : strings.faderPointerLegend;
}

/** The arrow keys in 0.5 dB steps; null for any other key. */
export function keySteps(key: string): number | null {
  if (key === "ArrowUp" || key === "ArrowRight") return 1;
  if (key === "ArrowDown" || key === "ArrowLeft") return -1;
  return null;
}

/** Where a drag puts the thumb: from where it started, the pointer's travel as a fraction, finer with Shift or Alt. */
export function dragPosition(start: number, travel: number, isFine: boolean): number {
  return Math.min(1, Math.max(0, start + travel * (isFine ? FINE_FACTOR : 1)));
}

