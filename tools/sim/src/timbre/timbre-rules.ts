// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The rules of the timbre gate over measured sounds, pure (no rendering): preset pairs of
// one instrument, default sounds of one group, the listed pair targets and the point
// measurements of b.1. Thresholds live in ./timbre-targets.
import type { InstrumentGroup } from "@untzel/core";
import { RECORDED_INSTRUMENTS } from "./recorded-instruments";
import { envelopeRatio, mfccDistance, type TimbreFeatures } from "./timbre";
import {
  ENVELOPE_VARIANT_RATIO,
  KICK_DECAY_RATIO,
  KICK_INSTRUMENT,
  KICK_MFCC_MIN,
  PRESET_MIN,
  SAME_GROUP_MIN,
  type PairTarget,
  type SpectralTarget,
  type TargetException,
  type TargetRender,
} from "./timbre-targets";

export interface MeasuredSound {
  readonly id: string;
  readonly instrument: string;
  readonly group: InstrumentGroup;
  readonly preset: string;
  readonly isDefault: boolean;
  readonly features: TimbreFeatures;
}

export type PairRule = "preset" | "group" | "target";

export interface RuleResult {
  readonly rule: PairRule;
  readonly a: string;
  readonly b: string;
  readonly render: TargetRender;
  readonly distance: number;
  readonly min: number;
  /** Why the pair fails, or null when it passes. */
  readonly violation: string | null;
}

/** The larger of the attack ratio and the decay ratio of two sounds. */
export function envelopeContrast(a: TimbreFeatures, b: TimbreFeatures): number {
  return Math.max(envelopeRatio(a.attackSeconds, b.attackSeconds), envelopeRatio(a.decaySeconds, b.decaySeconds));
}

/** The kick rule: null when two kicks differ by MFCC or by decay, else why not. */
export function kickViolation(a: TimbreFeatures, b: TimbreFeatures): string | null {
  const distance = mfccDistance(a.mfcc, b.mfcc);
  const decay = envelopeRatio(a.decaySeconds, b.decaySeconds);
  if (distance >= KICK_MFCC_MIN || decay >= KICK_DECAY_RATIO) return null;
  return `MFCC ${distance.toFixed(1)} < ${KICK_MFCC_MIN} and decay ratio ${decay.toFixed(2)} < ${KICK_DECAY_RATIO}`;
}

/**
 * Rule 1: presets of one instrument at least PRESET_MIN apart, or an envelope variant
 * (ratio ≥ 2). Only one envelope-only pair per instrument passes: the one with the largest
 * envelope contrast, except on a recorded instrument, where each one passes. The
 * kick has its own rule (`kickViolation`).
 */
export function presetPairs(sounds: readonly MeasuredSound[]): RuleResult[] {
  const results: RuleResult[] = [];
  const instruments = [...new Set(sounds.map((sound) => sound.instrument))];
  for (const instrument of instruments) {
    const own = sounds.filter((sound) => sound.instrument === instrument);
    const envelopeOnly: { index: number; contrast: number }[] = [];
    for (let i = 0; i < own.length; i += 1) {
      for (let j = i + 1; j < own.length; j += 1) {
        const a = own[i]!;
        const b = own[j]!;
        const distance = mfccDistance(a.features.mfcc, b.features.mfcc);
        if (instrument === KICK_INSTRUMENT) {
          results.push({ rule: "preset", a: a.id, b: b.id, render: "note", distance, min: KICK_MFCC_MIN, violation: kickViolation(a.features, b.features) });
          continue;
        }
        const contrast = envelopeContrast(a.features, b.features);
        let violation: string | null = null;
        if (distance < PRESET_MIN) {
          if (contrast >= ENVELOPE_VARIANT_RATIO) envelopeOnly.push({ index: results.length, contrast });
          else violation = `MFCC ${distance.toFixed(1)} < ${PRESET_MIN} and envelope ratio ${contrast.toFixed(1)} < ${ENVELOPE_VARIANT_RATIO}`;
        }
        results.push({ rule: "preset", a: a.id, b: b.id, render: "note", distance, min: PRESET_MIN, violation });
      }
    }
    envelopeOnly.sort((x, y) => y.contrast - x.contrast);
    for (const extra of RECORDED_INSTRUMENTS.has(instrument) ? [] : envelopeOnly.slice(1)) {
      const result = results[extra.index]!;
      results[extra.index] = { ...result, violation: `MFCC ${result.distance.toFixed(1)} < ${PRESET_MIN}: a second envelope-only variant of ${instrument}` };
    }
  }
  return results;
}

/** Rule 2: default sounds of two instruments of one group at least SAME_GROUP_MIN apart. */
export function groupPairs(sounds: readonly MeasuredSound[]): RuleResult[] {
  const defaults = sounds.filter((sound) => sound.isDefault);
  const results: RuleResult[] = [];
  for (let i = 0; i < defaults.length; i += 1) {
    for (let j = i + 1; j < defaults.length; j += 1) {
      const a = defaults[i]!;
      const b = defaults[j]!;
      if (a.group !== b.group) continue;
      const distance = mfccDistance(a.features.mfcc, b.features.mfcc);
      const violation = distance >= SAME_GROUP_MIN ? null : `same group "${a.group}": MFCC ${distance.toFixed(1)} < ${SAME_GROUP_MIN}`;
      results.push({ rule: "group", a: a.id, b: b.id, render: "note", distance, min: SAME_GROUP_MIN, violation });
    }
  }
  return results;
}

/** Rule 3: the listed pairs. `lookup` returns null for a sound outside the run (`--only`). */
export function targetPairs(
  targets: readonly PairTarget[],
  lookup: (id: string, render: TargetRender) => TimbreFeatures | null | undefined,
): RuleResult[] {
  const results: RuleResult[] = [];
  for (const target of targets) {
    const a = lookup(target.a, target.render);
    const b = lookup(target.b, target.render);
    if (a === null || b === null) continue;
    if (a === undefined || b === undefined) {
      results.push({ rule: "target", a: target.a, b: target.b, render: target.render, distance: 0, min: target.min, violation: `${target.source}: no such sound` });
      continue;
    }
    const distance = mfccDistance(a.mfcc, b.mfcc);
    const violation = distance >= target.min ? null : `${target.source}: MFCC ${distance.toFixed(1)} < ${target.min} (${target.render})`;
    results.push({ rule: "target", a: target.a, b: target.b, render: target.render, distance, min: target.min, violation });
  }
  return results;
}

/** What a point measurement found: one number (or one per partial). */
export interface SpectralMeasure {
  readonly target: SpectralTarget;
  readonly values: readonly number[];
  readonly violation: string | null;
  /** Explained in TARGET_EXCEPTIONS instead of met. */
  readonly excepted?: boolean;
}

/** Rule 4: one measured value against its b.1 bound. */
export function spectralViolation(target: SpectralTarget, values: readonly number[]): string | null {
  const shown = values.map((value) => value.toFixed(1)).join(", ");
  switch (target.kind) {
    case "partials":
      return values.every((value) => value >= target.minDb && value <= target.maxDb)
        ? null
        : `${target.source}: partials ${target.ratios.join(", ")}× at ${shown} dB, outside ${target.minDb}..${target.maxDb}`;
    case "centroid":
      return (values[0] ?? 0) >= target.minHz ? null : `${target.source}: centroid ${shown} Hz < ${target.minHz}`;
    case "swing":
      return (values[0] ?? Infinity) <= target.maxDb ? null : `${target.source}: RMS swing ${shown} dB > ${target.maxDb}`;
    case "decay":
      return (values[0] ?? 0) >= target.minSeconds ? null : `${target.source}: decay ${shown} s < ${target.minSeconds}`;
    case "tone":
      return (values[0] ?? 0) >= target.min ? null : `${target.source}: tone 0 ~ tone 1 MFCC ${shown} < ${target.min}`;
  }
}

/** Applies the explained exceptions: an excepted failure passes, an excepted pass fails. */
export function withExceptions(target: SpectralTarget, violation: string | null, exceptions: readonly TargetException[]): string | null {
  const exception = exceptions.find((entry) => entry.kind === target.kind && entry.subject === target.subject);
  if (exception === undefined) return violation;
  if (exception.reason.trim() === "") return `${target.source}: an exception without a reason`;
  return violation === null ? `${target.source}: ${target.kind} of ${target.subject} passes now; remove its exception` : null;
}
