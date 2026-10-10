// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { ARP_MODES, EFFECT_PARAMETERS, VOICINGS } from "@untzel/core";
import { ARP_RATES, DIVISIONS, FLAGS, RULES, SPACES, rule } from "../read/modifier-values";

// What each general modifier accepts, for completion and help outside the analysis (the
// composer terminal and the editor). Read from the same tables the analysis uses, so a new
// modifier shows up here by itself.

export type GeneralModifierRule =
  | { readonly name: string; readonly kind: "flag" }
  | {
      readonly name: string;
      readonly kind: "number";
      readonly min: number;
      readonly max: number;
      readonly integer: boolean;
      readonly allowsSignal: boolean;
      readonly example: string;
    }
  | { readonly name: string; readonly kind: "reverb"; readonly spaces: readonly string[]; readonly example: string }
  | { readonly name: string; readonly kind: "choice"; readonly choices: readonly string[]; readonly example: string };

function choice(name: string, choices: readonly string[]): GeneralModifierRule {
  return { name, kind: "choice", choices, example: `${name} ${choices[0] ?? ""}` };
}

const NUMERIC_RULES = [
  ...Object.values(RULES),
  ...EFFECT_PARAMETERS.map((parameter) =>
    rule(parameter.name, parameter.min, parameter.max, String(parameter.added ?? parameter.default)),
  ),
];

export const GENERAL_MODIFIER_RULES: readonly GeneralModifierRule[] = [
  ...[...FLAGS].map((name) => ({ name, kind: "flag" as const })),
  ...NUMERIC_RULES.map((numeric): GeneralModifierRule =>
    numeric.name === "reverb"
      ? { name: numeric.name, kind: "reverb", spaces: SPACES, example: numeric.example }
      : {
          name: numeric.name,
          kind: "number",
          min: numeric.min,
          max: numeric.max,
          integer: numeric.integer,
          allowsSignal: numeric.allowsSignal,
          example: numeric.example,
        },
  ),
  choice("delay", DIVISIONS),
  choice("voicing", VOICINGS),
  choice("arp", ARP_MODES),
  choice("arp-rate", ARP_RATES),
];
