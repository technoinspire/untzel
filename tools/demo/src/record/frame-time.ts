// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Musical time, video frames and the page's virtual milliseconds. The video runs at 30
// frames a second and the take at 48 kHz, so frame k is sample
// k × 1 600 of the take. Frame 0 is the arm; the title card holds the first 45 frames, and
// the plan's beat 0 starts right after it. Pure.
export const FPS = 30;

export const SAMPLE_RATE = 48_000;

export const SAMPLES_PER_VIDEO_FRAME = SAMPLE_RATE / FPS;

/** The song's title card: 1.5 s, before anything plays. */
export const TITLE_CARD_FRAMES = 45;

/** The closing card of the brand: 2 s, after the last gesture. */
export const BRAND_CARD_FRAMES = 60;

/** Virtual milliseconds from the arm to the start of video frame `frame`. */
export function msOfFrame(frame: number): number {
  return (frame * 1000) / FPS;
}

/** The first video frame at or after `seconds` from the arm. */
export function frameOfSeconds(seconds: number): number {
  return Math.ceil(seconds * FPS - 1e-9);
}

/** The video frame where beat `beat` of the plan falls, at `tempo` bpm, after the title card. */
export function frameOfBeat(beat: number, tempo: number): number {
  return TITLE_CARD_FRAMES + frameOfSeconds((beat * 60) / tempo);
}

/** Seconds of video in `frames` frames. */
export function secondsOfFrames(frames: number): number {
  return frames / FPS;
}

/** m:ss.s, for the report and the log. */
export function clockOf(frames: number): string {
  const seconds = secondsOfFrames(frames);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(1).padStart(4, "0")}`;
}
