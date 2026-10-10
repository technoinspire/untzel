// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// How long a demo's capture runs, and the range a video demo must keep (one to
// three minutes): the title card, then the plan from its first beat to its last. Pure.
import type { Timeline } from "../pacing";
import { BRAND_CARD_FRAMES, TITLE_CARD_FRAMES, secondsOfFrames } from "./frame-time";
import { finalFrame, layerFrames } from "./gesture-schedule";
import { storyCut } from "./video/story-cut";

export const MIN_CAPTURE_SECONDS = 60;

export const MAX_CAPTURE_SECONDS = 180;

/** Seconds from the arm to the end of the take, as planned. */
export function captureSeconds(timeline: Timeline): number {
  return secondsOfFrames(finalFrame(timeline));
}

export function isCaptureInRange(seconds: number): boolean {
  return seconds >= MIN_CAPTURE_SECONDS && seconds <= MAX_CAPTURE_SECONDS;
}

/** A Story lasts this long at most, its two cards included. */
export const MAX_STORY_SECONDS = 60;

export interface PlannedStory {
  /** The Story's length, the title card and the brand's card included. */
  readonly seconds: number;
  /** The layer the cut starts on; null when no layer start fits and the cut falls inside one. */
  readonly fromLayer: string | null;
}

/** The Story cut of the plan, as the recorder makes it from the same frames. */
export function plannedStory(timeline: Timeline): PlannedStory {
  const starts = layerFrames(timeline);
  const cut = storyCut(starts, finalFrame(timeline));
  const layer = cut.isOnLayer ? timeline.layers[starts.indexOf(cut.fromFrame)] : undefined;
  return { seconds: secondsOfFrames(TITLE_CARD_FRAMES + cut.frames + BRAND_CARD_FRAMES), fromLayer: layer?.name ?? null };
}
