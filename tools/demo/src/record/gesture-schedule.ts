// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// From the plan to frames: when each action starts, how
// the cursor travels to a control (exponential out, so it arrives decided and settles), and
// when each key of typed code goes down, at the demo's reading speed. Pure.
import type { Timeline } from "../pacing";
import { FPS, frameOfBeat } from "./frame-time";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Frames a cursor trip takes: longer for a longer way, never a jump nor a crawl. */
export const MIN_TRAVEL_FRAMES = 4;

export const MAX_TRAVEL_FRAMES = 10;

const PIXELS_PER_EXTRA_FRAME = 160;

export function travelFrames(from: Point, to: Point): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.min(MAX_TRAVEL_FRAMES, MIN_TRAVEL_FRAMES + Math.round(distance / PIXELS_PER_EXTRA_FRAME));
}

/** Exponential out, scaled so that it ends exactly at 1. */
function easeOut(t: number): number {
  return (1 - 2 ** (-10 * t)) / (1 - 2 ** -10);
}

/** The cursor's position at the end of each of `frames` frames, the last one on `to`. */
export function cursorPath(from: Point, to: Point, frames: number): Point[] {
  return Array.from({ length: Math.max(1, frames) }, (_, index) => {
    const eased = easeOut((index + 1) / Math.max(1, frames));
    return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
  });
}

/**
 * Frames to wait before each key of `text`, at `charsPerSecond`: the fractions carry over, so
 * the whole text takes round(length × 30 ÷ speed) frames whatever its length.
 */
export function keyFrames(text: string, charsPerSecond: number): number[] {
  const perKey = FPS / charsPerSecond;
  const keys = [...text];
  return keys.map((_, index) => Math.round((index + 1) * perKey) - Math.round(index * perKey));
}

/** A burst holds whole words and at least this many characters, so each one reads as a step. */
export const MIN_BURST_CHARS = 8;

/** `text` in bursts of whole words, merged up to MIN_BURST_CHARS; a line break is a burst of its own. */
export function burstTexts(text: string): string[] {
  const bursts: string[] = [];
  let open = "";
  for (const word of text.split(/(?<=[ \n])/)) {
    const [body = "", rest] = word.split("\n");
    open += body;
    if (rest !== undefined) {
      if (open !== "") bursts.push(open);
      bursts.push("\n");
      open = "";
    } else if (open.length >= MIN_BURST_CHARS) {
      bursts.push(open);
      open = "";
    }
  }
  if (open !== "") bursts.push(open);
  return bursts;
}

/** Frames before a burst of `chars` characters at `charsPerSecond`: at least one, so each burst is seen. */
export function burstWaitFrames(chars: number, charsPerSecond: number): number {
  return Math.max(1, Math.round((chars * FPS) / charsPerSecond));
}

/** The video frame each action of the plan starts on. */
export function actionFrames(timeline: Timeline): number[] {
  return timeline.actions.map((timed) => frameOfBeat(timed.startBeat, timeline.tempo));
}

/** The frame each layer of the plan starts on, for the Story's cut. */
export function layerFrames(timeline: Timeline): number[] {
  return timeline.layers.map((layer) => frameOfBeat(layer.startBeat, timeline.tempo));
}

/** The frame the take ends on: the end of the plan's last bar, the finished song heard. */
export function finalFrame(timeline: Timeline): number {
  return frameOfBeat(timeline.totalBeats, timeline.tempo);
}
