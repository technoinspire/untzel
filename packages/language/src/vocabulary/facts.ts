// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The facts of the language as values, for generated documentation.
// Nothing here is a second copy: every list is the one the analyzer uses.
import { ARP_MODES, CHORD_QUALITY_NAMES, EFFECT_PARAMETERS, MAX_LOOP_BARS, MIN_LOOP_BARS, SCALE_NAMES, SIGNAL_SHAPES, VOICINGS } from "@untzel/core";
import * as limits from "../limits";
import { SECTION_GAIN_RULE } from "../read/read-arrangement";
import { LOOP_RULE, SWING_RULE, TEMPO_RULE } from "../read/read-globals";
import { ARP_RATES, DIVISIONS, FLAGS, RULES, SPACES } from "../read/modifier-values";
import { ENVELOPE_SHAPE } from "../read/read-values";
import { STATEMENT_KEYWORDS } from "../read/syntax-recovery";
import type { NumericRule } from "../read/read-values";

/** A numeric rule without its message example: the range a value must fit. */
export interface NumericFact {
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly integer: boolean;
  readonly allowsSignal: boolean;
}

export type ModifierFact =
  | { readonly kind: "flag"; readonly name: string }
  | ({ readonly kind: "number" } & NumericFact)
  | ({ readonly kind: "reverb"; readonly spaces: readonly string[] } & NumericFact)
  /** delay and arp-rate: one of the written divisions of a bar. */
  | { readonly kind: "division"; readonly name: string; readonly divisions: readonly string[] }
  /** voicing and arp: one of the named choices. */
  | { readonly kind: "choice"; readonly name: string; readonly choices: readonly string[] };

export interface LanguageFacts {
  /** Keywords of the grammar that are not signal shapes. */
  readonly keywords: readonly string[];
  readonly globals: {
    readonly tempo: NumericFact & { readonly default: number };
    readonly swing: NumericFact & { readonly default: number };
    readonly key: { readonly scales: readonly string[]; readonly default: string };
    /** `loop <bars>`: absent by default, so loop mode keeps every pattern's own cycle. */
    readonly loop: NumericFact & { readonly default: null };
  };
  /** General track modifiers, in the order GENERAL_MODIFIERS lists them. */
  readonly modifiers: readonly ModifierFact[];
  readonly sectionModifiers: readonly NumericFact[];
  readonly limits: Readonly<Record<string, number>>;
  readonly chordQualities: readonly string[];
  readonly signalShapes: readonly string[];
  readonly scales: readonly string[];
}

function fact(rule: NumericRule): NumericFact {
  return { name: rule.name, min: rule.min, max: rule.max, integer: rule.integer, allowsSignal: rule.allowsSignal };
}

function modifierFacts(): readonly ModifierFact[] {
  const flags: ModifierFact[] = [...FLAGS].map((name) => ({ kind: "flag", name }));
  const numeric: ModifierFact[] = Object.values(RULES).map((rule) =>
    rule.name === "reverb" ? { kind: "reverb", spaces: SPACES, ...fact(rule) } : { kind: "number", ...fact(rule) },
  );
  const effects: ModifierFact[] = EFFECT_PARAMETERS.map((parameter) => ({
    kind: "number",
    name: parameter.name,
    min: parameter.min,
    max: parameter.max,
    integer: false,
    allowsSignal: true,
  }));
  return [
    ...flags,
    ...numeric,
    { kind: "division", name: "delay", divisions: DIVISIONS },
    { kind: "choice", name: "voicing", choices: VOICINGS },
    { kind: "choice", name: "arp", choices: ARP_MODES },
    { kind: "division", name: "arp-rate", divisions: ARP_RATES },
    ...effects,
  ];
}

export const LANGUAGE_FACTS: LanguageFacts = {
  keywords: STATEMENT_KEYWORDS,
  globals: {
    tempo: { ...fact(TEMPO_RULE), default: limits.DEFAULT_TEMPO },
    swing: { ...fact(SWING_RULE), default: 0 },
    key: { scales: SCALE_NAMES, default: "c minor" },
    loop: { ...fact(LOOP_RULE), default: null },
  },
  modifiers: modifierFacts(),
  sectionModifiers: [fact(TEMPO_RULE), fact(SECTION_GAIN_RULE)],
  limits: { ...limits, MIN_LOOP_BARS, MAX_LOOP_BARS },
  chordQualities: CHORD_QUALITY_NAMES,
  signalShapes: [...SIGNAL_SHAPES, ENVELOPE_SHAPE],
  scales: SCALE_NAMES,
};
