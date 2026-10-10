// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { curvePosition, envelopePosition, positionOfPhase, valueAt } from "@untzel/core";
import type { LightCue } from "../ports";
// The tone the DSP produces `age` seconds into a cue: the cutoff drive follows a
// fast LFO or an envelope on tone[0] over the cue's life, with the engine's own formula.

export function toneAt(cue: LightCue, age: number): number {
  const motion = cue.toneMotion;
  if (motion === null) return cue.tone;
  const position =
    motion.kind === "lfo"
      ? positionOfPhase(motion.shape, fraction(motion.phaseAtEvent + Math.max(0, age) / motion.periodSeconds))
      : envelopePosition(motion.seconds, Math.max(0, age));
  const value = valueAt(motion, position);
  const tone = curvePosition(motion.mapping.curve, motion.mapping.from, motion.mapping.to, value);
  return Number.isFinite(tone) ? Math.min(1, Math.max(0, tone)) : cue.tone;
}

function fraction(value: number): number {
  return Math.fround(value - Math.floor(value));
}
