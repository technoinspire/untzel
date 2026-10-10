// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentKind, StepPitch } from "@untzel/core";
import type { StepView } from "@untzel/presentation/view-model";
import type { AuditionSound } from "@untzel/skin-contract";
import { stepPitchOf } from "./note-picker-model";

// Which sound a touch plays. Pure, tested without the
// DOM: the views emit the result as an audition intent and never talk to audio.

/** A note or chord sounds; a hold or rest has nothing to play. */
export function soundOfPitch(pitch: StepPitch | null): AuditionSound | null {
  if (pitch === null) return null;
  return pitch.kind === "note" || pitch.kind === "chord" ? pitch : null;
}

/**
 * A tap on a step. A drum step that turns on plays its hit (one that turns off is
 * silent); a melodic step plays what it holds, and a rest or hold nothing.
 */
export function soundOfStepTap(step: StepView, kind: InstrumentKind): AuditionSound | null {
  if (kind === "drum") return step.kind === "rest" ? { kind: "hit" } : null;
  return soundOfPitch(stepPitchOf(step));
}
