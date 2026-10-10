// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Is a play range gapless? Measured on the rendered audio: the largest jump
// between neighbouring samples in the 2 ms around every bar line, against the same in the
// 2 ms around the middle of every bar (a beat that is no boundary), and the quietest
// 50 ms of the whole render. A click at the wrap or the jump would be a boundary jump
// above the beats'; a gap would be a quiet window.
import type { RenderedAudio } from "../render/simulate";

const AROUND_SECONDS = 0.002;
const WINDOW_SECONDS = 0.05;

export interface BoundaryCheck {
  readonly bars: number;
  /** Largest |x[n] − x[n−1]| within ±2 ms of a bar line, either channel. */
  readonly maxBoundaryStep: number;
  /** The same around the middle of each bar. */
  readonly maxMidStep: number;
  /** RMS of the quietest 50 ms window after the start, in dBFS. */
  readonly quietestWindowDbfs: number;
}

export function checkBoundaries(audio: RenderedAudio, startFrame: number, sampleRate: number, bpm: number, bars: number): BoundaryCheck {
  const barFrames = (240 * sampleRate) / bpm;
  const around = Math.round(AROUND_SECONDS * sampleRate);
  let maxBoundaryStep = 0;
  let maxMidStep = 0;
  for (let bar = 1; bar < bars; bar += 1) {
    maxBoundaryStep = Math.max(maxBoundaryStep, maxStep(audio, Math.round(startFrame + bar * barFrames), around));
    maxMidStep = Math.max(maxMidStep, maxStep(audio, Math.round(startFrame + (bar - 0.5) * barFrames), around));
  }
  return { bars, maxBoundaryStep, maxMidStep, quietestWindowDbfs: quietestWindow(audio, startFrame, Math.round(startFrame + bars * barFrames), Math.round(WINDOW_SECONDS * sampleRate)) };
}

function maxStep(audio: RenderedAudio, centre: number, around: number): number {
  let step = 0;
  const from = Math.max(1, centre - around);
  const to = Math.min(audio.left.length, centre + around);
  for (let frame = from; frame < to; frame += 1) {
    step = Math.max(step, Math.abs((audio.left[frame] ?? 0) - (audio.left[frame - 1] ?? 0)), Math.abs((audio.right[frame] ?? 0) - (audio.right[frame - 1] ?? 0)));
  }
  return step;
}

function quietestWindow(audio: RenderedAudio, from: number, to: number, window: number): number {
  let quietest = Infinity;
  for (let start = from; start + window <= Math.min(to, audio.left.length); start += window) {
    let sum = 0;
    for (let frame = start; frame < start + window; frame += 1) {
      const left = audio.left[frame] ?? 0;
      const right = audio.right[frame] ?? 0;
      sum += (left * left + right * right) / 2;
    }
    quietest = Math.min(quietest, Math.sqrt(sum / window));
  }
  return quietest === Infinity || quietest === 0 ? -Infinity : 20 * Math.log10(quietest);
}
