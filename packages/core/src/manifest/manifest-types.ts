// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneSpec } from "./scene-catalog";

import type { EngineName } from "./engine-parameters";
import type { PitchRange } from "../pitch/pitch-range";
import type { Curve } from "../pattern/signal";

// Types of instruments/<name>/manifest.json.
// The readers live in manifest.ts and its manifest-*.ts parts.

export type InstrumentGroup = "drums" | "bass" | "keys" | "plucks" | "pads" | "brass" | "leads" | "voices" | "fx";
export type InstrumentKind = "drum" | "pitched" | "chord";
export type InstrumentEngine = "legacy" | EngineName;
export type VoiceAllocation = "poly" | "mono";
export type VoiceSteal = "oldest" | "released-quietest";

export const INSTRUMENT_GROUPS: readonly InstrumentGroup[] = [
  "drums",
  "bass",
  "keys",
  "plucks",
  "pads",
  "brass",
  "leads",
  "voices",
  "fx",
];

export interface ManifestParameter {
  readonly name: string;
  /** A choice parameter has min 0, max choices.length − 1 and an index default. */
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly unit: string;
  /** "exponential" requires min > 0. */
  readonly curve: Curve;
  /** Names of a choice parameter (`wave`), in DSP index order; null when continuous. */
  readonly choices: readonly string[] | null;
}

export interface ToneMapping {
  readonly parameter: string;
  readonly from: number;
  readonly to: number;
}

/** A named starting pattern: written in c minor, like the preview. */
export interface ManifestPattern {
  /** A label in English, 1..24 characters, for example "Four on the floor". */
  readonly name: string;
  readonly text: string;
}

export interface InstrumentPreset {
  readonly name: string;
  readonly description: string;
  /** Instrument parameter values by name; a choice is its index. */
  readonly values: Readonly<Record<string, number>>;
}

/** Public contract of instruments/<name>/manifest.json, validated and normalised. */
export interface InstrumentManifest {
  readonly name: string;
  readonly group: InstrumentGroup;
  readonly kind: InstrumentKind;
  readonly engine: InstrumentEngine;
  /** One line for the library, 8..60 characters, English. */
  readonly description: string;
  /**
   * Untzel's own model name, shown next to the language word: "AURA Grand",
   * "FLUX M24". 3..20 characters; never a third party's brand. Null when the manifest has none.
   */
  readonly model: string | null;
  /** Search words, at most 8. */
  readonly tags: readonly string[];
  /** Voice pool size per instance, 1..32. */
  readonly voices: number;
  readonly allocation: VoiceAllocation;
  readonly steal: VoiceSteal;
  /** Relative cost; kick = 1. Measured by `pnpm sim --costs`. */
  readonly costPerVoice: number;
  /** The first of `patterns`: what a new track starts with. Analyzed by language, not here. */
  readonly defaultPattern: string;
  /** 1..6 named starting patterns, in c minor; the JSON field that replaces `defaultPattern`. */
  readonly patterns: readonly ManifestPattern[];
  /** One or two bars written in c minor for the audition; at most 256 characters. */
  readonly preview: string;
  readonly defaultDuck: number;
  readonly parameters: readonly ManifestParameter[];
  readonly tone: readonly ToneMapping[];
  /** 1..12 named sounds; the default one has no values. */
  readonly presets: readonly InstrumentPreset[];
  readonly defaultPreset: string;
  /** The light the instrument draws; null takes its category's default. */
  readonly scene: SceneSpec | null;
  /** Playable notes of a pitched or chord instrument; null for drum ones. */
  readonly range: PitchRange | null;
  /**
   * How many dB the level moves from tone 0 to tone 1 (measured by pnpm sim --gain).
   * A written tone corrects the gain by the opposite, so tone changes the colour and not
   * the volume. 0 when tone does not move the level.
   */
  readonly toneLevelDb: number;
}

export interface ManifestIssue {
  /** JSON path of the offending field, for example "parameters[1].min". */
  readonly path: string;
  readonly message: string;
}

export type ManifestResult =
  | { readonly ok: true; readonly manifest: InstrumentManifest }
  | { readonly ok: false; readonly issues: readonly ManifestIssue[] };
