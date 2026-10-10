// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The stretch of a take that becomes a file. The origin is said once and used by every
// renderer, so sample 0 and the duration never come from two computations.
import { MIN_TAKE_SECONDS, type Take } from "./take";

/** firstSound: t0 → endFrame (a take, and the simulator checking the page); arm: armFrame → endFrame (the demo). */
export type TakeOrigin = "firstSound" | "arm";

export interface TakeSpan {
  readonly startFrame: number;
  readonly endFrame: number;
  readonly seconds: number;
}

/** Null without t0 (firstSound) or under MIN_TAKE_SECONDS from the origin. */
export function takeSpan(take: Take, origin: TakeOrigin = "firstSound"): TakeSpan | null {
  const startFrame = origin === "arm" ? take.armFrame : firstSoundOf(take);
  if (startFrame === null) return null;
  const seconds = (take.endFrame - startFrame) / take.sampleRate;
  if (seconds < MIN_TAKE_SECONDS) return null;
  return { startFrame, endFrame: take.endFrame, seconds };
}

/** t0: the startFrame of the first play that started the music. */
function firstSoundOf(take: Take): number | null {
  for (const entry of take.entries) if (entry.startFrame !== undefined) return entry.startFrame;
  return null;
}
