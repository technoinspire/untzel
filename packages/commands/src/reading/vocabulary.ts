// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { instrumentNames, SCALE_NAMES, type InstrumentManifest, type InstrumentRegistry, type ManifestParameter } from "@untzel/core";
import { GENERAL_MODIFIER_RULES, readNames, type DeclaredNames } from "@untzel/language";

// What the terminal and the editor can name, read from the registry and the grammar's
// lists, never written down here: a new instrument or parameter shows up by itself.

export const TONICS: readonly string[] = ["c", "c#", "db", "d", "d#", "eb", "e", "f", "f#", "gb", "g", "g#", "ab", "a", "a#", "bb", "b"];
export const SCALES: readonly string[] = SCALE_NAMES;
export const SIGNAL_SHAPES: readonly string[] = ["sine", "tri", "saw", "square", "rand"];
/** Statements that start a line, besides a track. */
export const STATEMENT_WORDS: readonly string[] = ["title", "tempo", "key", "swing", "loop", "section", "song"];

/** A modifier a track accepts: general, or a parameter of its instrument. */
export type ParameterInfo =
  | { readonly kind: "flag"; readonly name: string }
  | {
      readonly kind: "number";
      readonly name: string;
      readonly min: number;
      readonly max: number;
      readonly integer: boolean;
      readonly allowsSignal: boolean;
      /** The manifest default; null for general modifiers, which have an example instead. */
      readonly default: number | null;
      readonly unit: string;
      /** How a slider maps to the value; null for general modifiers. */
      readonly curve: "linear" | "exponential" | null;
      readonly example: string;
      /** The instrument it belongs to; null for general modifiers. */
      readonly instrument: string | null;
    }
  | { readonly kind: "choice"; readonly name: string; readonly choices: readonly string[]; readonly example: string };

/** "gain 0.8" -> "0.8": the rules carry the whole example. */
function exampleValue(name: string, example: string): string {
  return example.startsWith(`${name} `) ? example.slice(name.length + 1) : example;
}

function generalParameters(): readonly ParameterInfo[] {
  return GENERAL_MODIFIER_RULES.map((rule): ParameterInfo => {
    switch (rule.kind) {
      case "flag":
        return { kind: "flag", name: rule.name };
      case "reverb":
        // A send 0..1 or a space name; the analysis checks which.
        return { kind: "choice", name: rule.name, choices: rule.spaces, example: exampleValue(rule.name, rule.example) };
      case "choice":
        return { kind: "choice", name: rule.name, choices: rule.choices, example: exampleValue(rule.name, rule.example) };
      case "number":
        return { ...rule, kind: "number", default: null, unit: "", curve: null, example: exampleValue(rule.name, rule.example), instrument: null };
    }
  });
}

function manifestParameters(manifest: InstrumentManifest): readonly ParameterInfo[] {
  return manifest.parameters.map((parameter): ParameterInfo =>
    parameter.choices === null ? numberParameter(manifest, parameter) : choiceParameter(parameter, parameter.choices),
  );
}

/** A manifest parameter with named values (`wave square`). */
function choiceParameter(parameter: ManifestParameter, choices: readonly string[]): ParameterInfo {
  return { kind: "choice", name: parameter.name, choices, example: choices[parameter.default] ?? choices[0] ?? "" };
}

function numberParameter(manifest: InstrumentManifest, parameter: ManifestParameter): ParameterInfo {
  return {
    kind: "number",
    name: parameter.name,
    min: parameter.min,
    max: parameter.max,
    integer: false,
    allowsSignal: true,
    default: parameter.default,
    unit: parameter.unit,
    curve: parameter.curve,
    example: String(parameter.default),
    instrument: manifest.name,
  };
}

export class Vocabulary {
  readonly #registry: InstrumentRegistry;
  readonly #general = generalParameters();

  constructor(registry: InstrumentRegistry) {
    this.#registry = registry;
  }

  instruments(): readonly string[] {
    return instrumentNames(this.#registry);
  }

  manifest(instrument: string): InstrumentManifest | undefined {
    return this.#registry.get(instrument);
  }

  isPitched(instrument: string): boolean {
    return this.manifest(instrument)?.kind !== "drum";
  }

  /** The instrument's own parameters first: they are what makes the track sound different. */
  parametersOf(instrument: string): readonly ParameterInfo[] {
    const manifest = this.manifest(instrument);
    return [...(manifest === undefined ? [] : manifestParameters(manifest)), ...this.#general];
  }

  parameter(instrument: string, name: string): ParameterInfo | undefined {
    return this.parametersOf(instrument).find((parameter) => parameter.name === name);
  }

  /** Track and section names the text declares, even while it has errors. */
  names(source: string): DeclaredNames {
    return readNames(source);
  }
}
