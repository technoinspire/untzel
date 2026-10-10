// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "./read/analyze";

// Reference texts of the language: every one of them must keep analyzing.

function example(name: string): string {
  return readFileSync(new URL(`./fixtures/conformance/${name}`, import.meta.url), "utf8");
}

const song = example("song.untzel");
const loop = example("loop.untzel");
const slowSignal = example("slow-signal.untzel");
const kickHatBass = example("kick-hat-bass.untzel");
const languageBlocks = [song, loop, slowSignal];
const onboard = song;
const phaseOneOnboard = kickHatBass;
const real = registryWith(["kick", "hat", "bass"]);

describe("language examples conformance", () => {
  it("finds the examples", () => {
    expect(languageBlocks.length).toBeGreaterThanOrEqual(2);
    expect(onboard).not.toBe("");
    expect(phaseOneOnboard).not.toBe("");
  });

  it.each(languageBlocks.map((block, index) => [index, block] as const))(
    "analyzes example %i with zero diagnostics against the full registry",
    (_, block) => {
      const result = analyze(block, registryWith());
      expect(result.ok ? result.warnings : result.diagnostics).toEqual([]);
      expect(result.ok).toBe(true);
    },
  );

  it("gives only UNKNOWN_INSTRUMENT, once per later instrument, for the song example with the kick, hat and bass registry", () => {
    const result = analyze(onboard, real);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const later = [...onboard.matchAll(/^[a-z0-9]+:\s+([a-z-]+)/gm)].map((match) => match[1] ?? "").filter((name) => !["kick", "hat", "bass"].includes(name));
    const found = result.diagnostics.map((diagnostic) => [diagnostic.code, onboard.slice(diagnostic.from, diagnostic.to)]);
    expect(found).toEqual(later.map((name) => ["UNKNOWN_INSTRUMENT", name]));
    for (const diagnostic of result.diagnostics) {
      const line = onboard.slice(onboard.lastIndexOf("\n", diagnostic.from) + 1, diagnostic.from);
      expect(line).toMatch(/^[a-z0-9]+:\s+$/);
    }
  });

  it("never crashes on later instruments: every example gives only UNKNOWN_INSTRUMENT", () => {
    for (const block of languageBlocks) {
      const result = analyze(block, real);
      const codes = result.ok ? [] : result.diagnostics.map((diagnostic) => diagnostic.code);
      expect(new Set(codes).size).toBeLessThanOrEqual(1);
      for (const code of codes) expect(code).toBe("UNKNOWN_INSTRUMENT");
    }
  });

  it("analyzes the kick, hat and bass onboard with zero diagnostics", () => {
    const result = analyze(phaseOneOnboard, real);
    expect(result.ok ? result.warnings : result.diagnostics).toEqual([]);
  });

  it("analyzes the default pattern of every real manifest", () => {
    const registry = real;
    for (const manifest of registry.values()) {
      const result = analyze(`t: ${manifest.name} ${manifest.defaultPattern}`, registry);
      expect(result.ok ? result.warnings : result.diagnostics).toEqual([]);
    }
  });
});
