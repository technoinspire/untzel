// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { GeneralParameter } from "@untzel/core";
import type { ActivatedTrack, ParameterPoint } from "@untzel/session";
// What a parameter point does to a track's audibility: the light follows the
// sound. The session's solo arrives as constant points on `audible` (index 9), which the
// DSP applies after gain and its modulators. A constant gain point of 0 silences a track
// with no gain modulator; on a track with one, the DSP ignores outside writes to the
// modulated index, and so does the light. `| mute` is structural: no point undoes it.

export interface TrackSound {
  readonly isMuted: boolean;
  readonly isGainZero: boolean;
  readonly isSoloedOut: boolean;
  readonly hasGainModulator: boolean;
}

export function trackSound(track: ActivatedTrack): TrackSound {
  const hasGainModulator = track.modulators.some((modulator) => modulator.index === GeneralParameter.gain);
  return {
    isMuted: track.isMuted,
    isGainZero: !track.isAudible && !track.isMuted && (track.parameters[GeneralParameter.audible] ?? 1) !== 0,
    isSoloedOut: (track.parameters[GeneralParameter.audible] ?? 1) === 0,
    hasGainModulator,
  };
}

export function isAudibleSound(sound: TrackSound): boolean {
  return !sound.isMuted && !sound.isSoloedOut && !sound.isGainZero;
}

/** The sound after a point; unchanged for a point on any other parameter. */
export function audibleAfterPoint(sound: TrackSound, point: ParameterPoint): TrackSound {
  if (point.parameter === GeneralParameter.audible) return { ...sound, isSoloedOut: point.value === 0 };
  if (point.parameter !== GeneralParameter.gain || sound.hasGainModulator) return sound;
  return { ...sound, isGainZero: point.isConstant && point.value === 0 };
}
