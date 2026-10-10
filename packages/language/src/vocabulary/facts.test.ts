// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pitchClassName, toNumber } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import { LANGUAGE_FACTS } from "./facts";
import * as terms from "../generated/parser.terms";
import { GENERAL_MODIFIERS } from "../read/modifier-values";

const grammar = readFileSync(fileURLToPath(new URL("../untzel.grammar", import.meta.url)), "utf8");

describe("LANGUAGE_FACTS against the grammar", () => {
  it("keywords and signal shapes are exactly the lower-case terms of the parser, without overlap", () => {
    const lowerTerms = Object.keys(terms).filter((name) => /^[a-z]/.test(name));
    const facts = [...LANGUAGE_FACTS.keywords, ...LANGUAGE_FACTS.signalShapes];
    expect(new Set(facts).size).toBe(facts.length);
    expect(new Set(lowerTerms)).toEqual(new Set(facts));
  });

  it("signal shapes are the kw<> list of SignalShape in untzel.grammar", () => {
    const rule = /SignalShape \{([^}]*)\}/.exec(grammar)?.[1] ?? "";
    const shapes = [...rule.matchAll(/kw<"([a-z]+)">/g)].map((match) => match[1]);
    expect(shapes).toEqual([...LANGUAGE_FACTS.signalShapes]);
  });

  it("chord qualities are the suffixes of the Chord token", () => {
    const token = /Chord \{([^}]*)\}/.exec(grammar)?.[1] ?? "";
    const suffixes = [...token.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(suffixes)).toEqual(new Set(LANGUAGE_FACTS.chordQualities.filter((quality) => quality !== "major")));
  });

  it("lists every general modifier once, in the analyzer's order", () => {
    expect(LANGUAGE_FACTS.modifiers.map((modifier) => modifier.name)).toEqual([...GENERAL_MODIFIERS]);
  });

  it("the documented defaults are the analyzer's defaults", () => {
    const result = analyze("kick x...", registryWith(["kick", "hat", "bass"]));
    if (!result.ok) throw new Error("expected a program");
    const { tempo, swing, key } = LANGUAGE_FACTS.globals;
    expect(toNumber(result.program.tempo)).toBe(tempo.default);
    expect(toNumber(result.program.swing)).toBe(swing.default);
    expect(`${pitchClassName(result.program.key.tonic)} ${result.program.key.scale}`).toBe(key.default);
    expect(result.program.loopBars).toBe(LANGUAGE_FACTS.globals.loop.default);
  });
  it("the documented loop range is the one the analyzer accepts", () => {
    const registry = registryWith(["kick", "hat", "bass"]);
    const { min, max } = LANGUAGE_FACTS.globals.loop;
    const read = (bars: number) => analyze(`loop ${bars}\nkick x...`, registry);
    const atMax = read(max);
    expect(atMax.ok && atMax.program.loopBars).toBe(max);
    expect(read(min).ok).toBe(true);
    expect(read(max + 1).ok).toBe(false);
    expect(read(min - 1).ok).toBe(false);
  });
});
