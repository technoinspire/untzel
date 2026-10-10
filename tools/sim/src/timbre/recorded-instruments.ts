// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The instruments that play a recording, read from the instrument index: a recorded
// instrument added by its folder in instruments/ is judged as one without editing the gate.
import type { InstrumentRegistry } from "@untzel/core";
import { samplePackInstruments } from "@untzel/instrument-index";
import { simRegistry } from "../registry";
/**
 * The instruments with a sample pack outside the voices group: the voices' packs are the vowel
 * recordings of VocalSet, and vox and choir keep the rules of a synthesized instrument.
 */
export function recordedInstruments(registry: InstrumentRegistry, packs: readonly string[]): ReadonlySet<string> {
  return new Set(packs.filter((name) => registry.get(name)?.group !== "voices"));
}
/**
 * Instruments that play a recording: their named sounds shape one recorded instrument by
 * envelope and tone, so every envelope variant (ratio ≥ 2) passes, not one.
 */
export const RECORDED_INSTRUMENTS: ReadonlySet<string> = recordedInstruments(simRegistry().registry, samplePackInstruments);
