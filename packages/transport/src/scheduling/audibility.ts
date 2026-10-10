// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { GeneralParameter } from "@untzel/core";
import type { ActivatedModulator } from "../types";
// Whether a track of an activation sounds, for the light: the light follows what
// the DSP does, never the other way round. The DSP applies `audible` (the session's solo)
// after gain and its modulators, and runs a gain modulator over the constant it starts
// from, so a `gain sine 1/8 0..1` track sounds even though its resolved gain is 0.

export interface AudibilityInput {
  readonly isMuted: boolean;
  /** Every DSP index at the activation's frame. */
  readonly parameters: readonly number[];
  /** The written gain is a constant (no slow signal moving it). */
  readonly isGainConstant: boolean;
  readonly modulators: readonly ActivatedModulator[];
}

export function isAudibleActivation(track: AudibilityInput): boolean {
  if (track.isMuted) return false;
  if ((track.parameters[GeneralParameter.audible] ?? 1) === 0) return false;
  const gain = track.parameters[GeneralParameter.gain] ?? 1;
  if (gain !== 0 || !track.isGainConstant) return true;
  return track.modulators.some((modulator) => modulator.index === GeneralParameter.gain && (modulator.low !== 0 || modulator.high !== 0));
}
