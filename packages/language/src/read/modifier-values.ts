// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { EFFECT_PARAMETERS, type DelayDivisionName, type ReverbSpaceName, type WrittenReverb, type WrittenValue } from "@untzel/core";
import type { DiagnosticList } from "../diagnostics/diagnostics";
import { MAX_SHIFT, MAX_SWING, MAX_TRANSPOSE } from "../limits";
import { choiceFix, replaceFix, valueFix } from "../diagnostics/fixes";
import { messages } from "../copy/messages";
import type { ModifierSyntax, Token, ValueSyntax } from "../highlight/outline";
import { numberOf, readNumericValue, type NumericRule } from "./read-values";
import { closest } from "../diagnostics/suggest";

// The value rules of track modifiers and the readers shared by every modifier family
// (general, insert effects, chords and the arpeggiator).

export function rule(name: string, min: number, max: number, example: string, options: Partial<NumericRule> = {}): NumericRule {
  return { name, min, max, integer: false, allowsSignal: true, example: `${name} ${example}`, ...options };
}

export const RULES = {
  /** Up to 2 (+6 dB) for the gain fader; a section's gain keeps its own limit. */
  gain: rule("gain", 0, 2, "0.8", { allowsFast: true }),
  pan: rule("pan", -1, 1, "-0.3", { allowsFast: true }),
  duck: rule("duck", 0, 1, "0.5"),
  tone: rule("tone", 0, 1, "0.5"),
  reverb: rule("reverb", 0, 1, "wide"),
  transpose: rule("transpose", -MAX_TRANSPOSE, MAX_TRANSPOSE, "12", { integer: true, allowsSignal: false }),
  swing: rule("swing", 0, MAX_SWING, "0.12", { allowsSignal: false }),
  shift: rule("shift", -MAX_SHIFT, MAX_SHIFT, "2", { integer: true, allowsSignal: false }),
  velocity: rule("velocity", 0, 1, "0.8", { allowsSignal: false }),
  glide: rule("glide", 0, 2, "0.08", { allowsSignal: false }),
  inversion: rule("inversion", 0, 3, "1", { integer: true, allowsSignal: false }),
  "arp-octaves": rule("arp-octaves", 1, 3, "2", { integer: true, allowsSignal: false }),
} as const;

export const FLAGS: ReadonlySet<string> = new Set(["mute", "free", "legato"]);
export const SPACES: readonly ReverbSpaceName[] = ["small", "wide", "sea", "room", "plate", "hall", "dub"];
export const DIVISIONS: readonly DelayDivisionName[] = ["1/8", "3/16", "1/4"];
/** Where a number alone sends (core's resolveTrackParameters): the fix when no space is near. */
const NUMBER_ONLY_SPACE: ReverbSpaceName = "wide";
/** The note lengths `arp-rate` accepts. */
export const ARP_RATES: readonly string[] = ["1/4", "1/8", "3/16", "1/12", "1/16", "1/24", "1/32"];

/** Modifiers every track accepts, whatever the instrument. */
export const GENERAL_MODIFIERS: readonly string[] = [
  ...FLAGS,
  ...Object.keys(RULES),
  "delay",
  "voicing",
  "arp",
  "arp-rate",
  ...EFFECT_PARAMETERS.map((parameter) => parameter.name),
];

/** Counts DSP modulators: returns the value, or null once the track has too many. */
export type ModulatorCounter = (modifier: ModifierSyntax, value: WrittenValue | null) => WrittenValue | null;

/** The written value as one token, for a fix that replaces it; null for a signal. */
function valueToken(value: ValueSyntax): Token | null {
  switch (value.kind) {
    case "name":
      return value.name;
    case "number":
      return value.number;
    case "division":
      return { text: `${value.numerator.text}/${value.denominator.text}`, from: value.from, to: value.to };
    default:
      return null;
  }
}

export function readReverb(modifier: ModifierSyntax, diagnostics: DiagnosticList): WrittenReverb | null {
  const { value } = modifier;
  if (value?.kind === "name") {
    const space = SPACES.find((name) => name === value.name.text);
    if (space !== undefined) return { kind: "space", space, send: null };
    const suggestion = closest(value.name.text, SPACES);
    const fix = choiceFix(value.name, suggestion, NUMBER_ONLY_SPACE);
    diagnostics.error("OUT_OF_RANGE", messages.reverbValue(suggestion?.text ?? null), value.name, fix);
    return null;
  }
  if (value?.kind === "division") {
    diagnostics.error("OUT_OF_RANGE", messages.reverbValue(), value);
    return null;
  }
  const send = readNumericValue(modifier, RULES.reverb, diagnostics);
  return send === null ? null : { kind: "send", value: send };
}

/**
 * A named space and a number written on one track go together: `reverb plate |
 * reverb 0.15` sends 0.15 into the plate. Otherwise the last `reverb` wins.
 */
export function combineReverb(previous: WrittenReverb | null, next: WrittenReverb | null): WrittenReverb | null {
  if (next === null) return previous;
  if (previous?.kind === "space" && next.kind === "send") return { ...previous, send: next.value };
  if (previous?.kind === "send" && next.kind === "space" && next.send === null) return { ...next, send: previous.value };
  return next;
}

export function divisionText(modifier: ModifierSyntax): string {
  const { value } = modifier;
  return value?.kind === "division" ? `${value.numerator.text}/${value.denominator.text}` : "";
}

export function readDelay(modifier: ModifierSyntax, diagnostics: DiagnosticList): DelayDivisionName | null {
  const { value } = modifier;
  if (value === null) {
    diagnostics.error("MISSING_VALUE", messages.missingValue("delay", "delay 1/8"), modifier.name, valueFix(modifier.name, "delay 1/8"));
    return null;
  }
  const division = DIVISIONS.find((name) => name === divisionText(modifier));
  if (division === undefined) diagnostics.error("OUT_OF_RANGE", messages.delayValue(), value, nearestDivisionFix(value));
  return division ?? null;
}

/** The bar fraction a written division or number stands for; null for anything else. */
function barsOf(value: ValueSyntax): number | null {
  if (value.kind === "number") return numberOf(value.number);
  if (value.kind !== "division") return null;
  const denominator = numberOf(value.denominator);
  return denominator === 0 ? null : numberOf(value.numerator) / denominator;
}

/** `delay 1/3` -> `delay 1/4`: the division of nearest length, as a clamp is the nearest limit. */
function nearestDivisionFix(value: ValueSyntax): ReturnType<typeof replaceFix> {
  const bars = barsOf(value);
  const token = valueToken(value);
  if (bars === null || token === null) return null;
  const length = (division: string): number => {
    const [numerator = 0, denominator = 1] = division.split("/").map(Number);
    return numerator / denominator;
  };
  const nearest = [...DIVISIONS].sort((a, b) => Math.abs(length(a) - bars) - Math.abs(length(b) - bars))[0];
  return replaceFix(token, nearest ?? null);
}

export function constantOf(value: WrittenValue | null): number | null {
  return value?.kind === "constant" ? value.value : null;
}

/** A name value out of a fixed list (`voicing open`, `arp updown`, `wave square`). */
export function readName<T extends string>(
  modifier: ModifierSyntax,
  choices: readonly T[],
  diagnostics: DiagnosticList,
): T | null {
  const { value } = modifier;
  const name = modifier.name.text;
  if (value === null) {
    const example = `${name} ${choices[0] ?? ""}`;
    diagnostics.error("MISSING_VALUE", messages.missingValue(name, example), modifier.name, valueFix(modifier.name, example));
    return null;
  }
  if (value.kind === "signal") {
    diagnostics.error("SIGNAL_NEEDS_NUMBER", messages.choiceNeedsName(name), value);
    return null;
  }
  const text = value.kind === "name" ? value.name.text : "";
  const found = choices.find((choice) => choice === text);
  if (found !== undefined) return found;
  // Anchored on the written name, with the closest choice; any other value gets the first.
  const token = valueToken(value);
  const suggestion = value.kind === "name" ? closest(text, choices) : null;
  const fix = token === null ? null : choiceFix(token, suggestion, choices[0]);
  diagnostics.error("UNKNOWN_CHOICE", messages.unknownChoice(name, choices, suggestion?.text ?? null), token ?? value, fix);
  return null;
}

export function isModulator(value: WrittenValue | null | undefined): boolean {
  return value?.kind === "fast" || value?.kind === "envelope";
}
