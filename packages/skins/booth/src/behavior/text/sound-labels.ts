// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Words of the sound group of the track detail.

import { EFFECT_KINDS } from "@untzel/core";
import { effectLabels, strings } from "../../copy/copy";
import type { EffectView } from "@untzel/presentation/view-model";

export function effectLabel(effect: string): string {
  return (effectLabels as Readonly<Record<string, string>>)[effect] ?? effect;
}

/** The effects a track can still add, in the chain's canonical order. */
export function addableEffects(effects: readonly EffectView[]): readonly string[] {
  const present = new Set(effects.map((entry) => entry.effect));
  return EFFECT_KINDS.filter((effect) => !present.has(effect));
}

export function soundButtonLabel(preset: string): string {
  return strings.soundOf(preset);
}

export function addEffectLabel(effect: string): string {
  return strings.addEffectNamed(effectLabel(effect));
}

export function removeEffectLabel(effect: string): string {
  return strings.removeEffect(effectLabel(effect));
}
