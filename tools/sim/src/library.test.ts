// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync } from "node:fs";
import { analyze } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { simRegistry } from "./registry";
import { LIBRARY_FILE } from "./measure/scale";
import { engineRepresentatives, instrumentStressSource } from "./stress";

const source = readFileSync(new URL(`../../../${LIBRARY_FILE}`, import.meta.url), "utf8");

describe("the library song", () => {
  const { registry, instruments } = simRegistry();
  const result = analyze(source, registry);

  it("analyzes without a diagnostic", () => {
    const problems = result.ok ? result.warnings : result.diagnostics;
    expect(problems.map((problem) => problem.message)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("has one track of every instrument, so a new one cannot skip the 6% budget", () => {
    if (!result.ok) throw new Error("library song does not analyze");
    const played = result.program.tracks.map((track) => track.instrument).sort();
    expect(played).toEqual(instruments.map((manifest) => manifest.name).sort());
  });

  it("carries the full insert chain on four tracks", () => {
    if (!result.ok) throw new Error("library song does not analyze");
    expect(result.program.tracks.filter((track) => track.effects.length === 9)).toHaveLength(4);
  });
});

describe("engineRepresentatives", () => {
  const { instruments } = simRegistry();

  it("picks one instrument of every engine, the one with the costliest voice pool", () => {
    const chosen = engineRepresentatives(instruments);
    expect(new Set(chosen.map((instrument) => instrument.engine))).toEqual(new Set(instruments.map((instrument) => instrument.engine)));
    for (const instrument of chosen) {
      const pool = instrument.costPerVoice * instrument.voices;
      const peers = instruments.filter((candidate) => candidate.engine === instrument.engine);
      expect(peers.every((peer) => peer.costPerVoice * peer.voices <= pool)).toBe(true);
    }
  });

  it("writes a stress text of one instrument that analyzes", () => {
    const { registry } = simRegistry();
    const [first] = engineRepresentatives(instruments);
    if (first === undefined) throw new Error("no instrument");
    const text = instrumentStressSource(first, 8);
    const analyzed = analyze(text, registry);
    expect(analyzed.ok && analyzed.program.tracks.length).toBe(8);
  });
});
