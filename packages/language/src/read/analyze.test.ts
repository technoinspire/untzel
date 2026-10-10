// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { rational, sourceHash, toNumber, type Program, type ResolvedParameter, type Track } from "@untzel/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "./analyze";

const registry = registryWith(["kick", "hat", "bass"]);

const ONBOARD = `// onboard (phase 1: kick, hat and bass only)
tempo 132
key c minor

kick:  kick  x... x... x... x...          | drive 0.3
hat:   hat   ..x. ..x. ..x. ..xx          | swing 0.12
ride:  hat   x.x. x.x. x.x. x.x.          | open 0.7 | gain 0.4 | pan -0.3
sub:   bass  c1 . . c1 . . c1 .           | cutoff 180
bass:  bass  . c2 . c2 . c2 . eb2         | cutoff sine(8) 300..1400 | pan 0.2

section intro  kick hat sub
section build  kick hat ride sub
section drop   kick hat ride sub bass
section break  hat bass

song intro 8, build 4, drop 16, break 8, build 4, drop 16
`;

function program(source: string): Program {
  const result = analyze(source, registry);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.program;
}

function track(source: string, name: string): Track {
  const found = program(source).tracks.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`no track ${name}`);
  return found;
}

function parameter(found: Track, name: string): ResolvedParameter {
  const resolved = found.parameters.find((candidate) => candidate.name === name);
  if (resolved === undefined) throw new Error(`no parameter ${name}`);
  return resolved;
}

describe("analyze: the onboard template", () => {
  const onboard = program(ONBOARD);

  it("reads globals exactly", () => {
    expect(toNumber(onboard.tempo)).toBe(132);
    expect(onboard.key).toEqual({ tonic: 0, scale: "minor" });
    expect(toNumber(onboard.swing)).toBe(0);
    expect(onboard.sourceHash).toBe(sourceHash(ONBOARD));
    expect(onboard.seedDependent).toBe(false);
  });

  it("keeps tracks in text order, with two independent bass instances", () => {
    expect(onboard.tracks.map((found) => [found.name, found.instrument])).toEqual([
      ["kick", "kick"],
      ["hat", "hat"],
      ["ride", "hat"],
      ["sub", "bass"],
      ["bass", "bass"],
    ]);
  });

  it("resolves parameters per DSP index", () => {
    const ride = track(ONBOARD, "ride");
    expect(parameter(ride, "open")).toEqual({ index: 32, name: "open", value: { kind: "constant", value: 0.7 }, explicit: true });
    expect(parameter(ride, "gain").value).toEqual({ kind: "constant", value: 0.4 });
    expect(parameter(ride, "pan").value).toEqual({ kind: "constant", value: -0.3 });
    expect(parameter(track(ONBOARD, "sub"), "duck").value).toEqual({ kind: "constant", value: 0.6 });
    expect(parameter(track(ONBOARD, "bass"), "cutoff").value).toEqual({
      kind: "signal",
      signal: { shape: "sine", periodBars: rational(8n, 1n) },
      low: 0,
      high: 1,
      from: 300,
      to: 1400,
      curve: "exponential",
    });
  });

  it("keeps the track swing exact and the whole line as source", () => {
    const hatTrack = track(ONBOARD, "hat");
    expect(hatTrack.swing).toEqual(rational(3n, 25n));
    expect(ONBOARD.slice(hatTrack.source.from, hatTrack.source.to)).toBe("hat:   hat   ..x. ..x. ..x. ..xx          | swing 0.12");
  });

  it("builds the pattern spec with source offsets per step", () => {
    const sub = track(ONBOARD, "sub");
    const [bar] = sub.pattern.bars;
    expect(bar?.elements.map((element) => element.kind)).toEqual(["note", "hits", "hits", "note", "hits", "hits", "note", "hits"]);
    const hits = track(ONBOARD, "kick").pattern.bars[0]?.elements[0];
    expect(hits?.kind === "hits" ? hits.steps : null).toEqual(["hit", "rest", "rest", "rest"]);
    expect(ONBOARD.slice(hits?.source.from, hits?.source.to)).toBe("x...");
  });

  it("reads sections and the song", () => {
    expect(onboard.sections.map((section) => [section.name, section.tracks])).toEqual([
      ["intro", ["kick", "hat", "sub"]],
      ["build", ["kick", "hat", "ride", "sub"]],
      ["drop", ["kick", "hat", "ride", "sub", "bass"]],
      ["break", ["hat", "bass"]],
    ]);
    expect(onboard.song?.parts.reduce((total, part) => total + part.bars, 0)).toBe(56);
    expect(onboard.song?.loop).toBe(false);
  });

  it("is structured-clone safe", () => {
    expect(structuredClone(onboard)).toEqual(onboard);
  });
});

describe("analyze: rules", () => {
  it("names unnamed tracks after explicit names are reserved", () => {
    const names = program("hat x...\nhat x...\nhat2: hat x...").tracks.map((found) => found.name);
    expect(names).toEqual(["hat", "hat3", "hat2"]);
  });

  it("lets the last repeated modifier win, with a warning", () => {
    const result = analyze("kick x... | gain 0.5 | gain 0.6", registry);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map((warning) => warning.code)).toEqual(["DUPLICATE_MODIFIER"]);
    expect(result.program.tracks[0]?.parameters[0]?.value).toEqual({ kind: "constant", value: 0.6 });
  });

  it("expands tone and lets an explicit parameter win", () => {
    const toned = track("b: bass c2 | tone 0.5", "b");
    expect((parameter(toned, "cutoff").value as { value: number }).value).toBeCloseTo(600, 9);
    expect(parameter(track("b: bass c2 | tone 1 | cutoff 300", "b"), "cutoff").value).toEqual({ kind: "constant", value: 300 });
  });

  it("reads flags, transposition, shift, reverb and delay", () => {
    const found = track("b: bass c2 | mute | free | transpose -12 | shift -3 | reverb sea | delay 3/16", "b");
    expect([found.muted, found.free, found.transpose, found.shift]).toEqual([true, true, -12, -3]);
    expect(parameter(found, "reverbSpace").value).toEqual({ kind: "constant", value: 2 });
    expect(parameter(found, "delayDivision").value).toEqual({ kind: "constant", value: 1 });
  });

  it("sends a written amount into a named room, in either order", () => {
    const plate = track("p: bass c2 | reverb plate | reverb 0.15", "p");
    expect(parameter(plate, "reverbSpace").value).toEqual({ kind: "constant", value: 4 });
    expect(parameter(plate, "reverbSend").value).toEqual({ kind: "constant", value: 0.15 });
    const dub = track("p: bass c2 | reverb 0.6 | reverb dub", "p");
    expect(parameter(dub, "reverbSpace").value).toEqual({ kind: "constant", value: 6 });
    expect(parameter(dub, "reverbSend").value).toEqual({ kind: "constant", value: 0.6 });
    const named = track("p: bass c2 | reverb hall", "p");
    expect(parameter(named, "reverbSend").value).toEqual({ kind: "constant", value: 0.3 });
  });

  it("marks programs that depend on the seed", () => {
    expect(program("kick x?...").seedDependent).toBe(true);
    expect(program("b: bass c2 | cutoff rand(4) 100..900").seedDependent).toBe(true);
    expect(program("b: bass c2 | tone rand(4) 0..1").seedDependent).toBe(true);
    expect(program("b: bass c2 | cutoff sine(4) 100..900").seedDependent).toBe(false);
  });

  it("reads section tempo and gain, song loop and CRLF", () => {
    const read = program("kick x...\r\nsection a kick | tempo 140 | gain 0.5\r\nsong a 8 | loop\r\n");
    expect(read.sections[0]).toEqual({ name: "a", tracks: ["kick"], tempo: rational(140n, 1n), gain: 0.5, isLoop: false });
    expect(read.song).toEqual({ parts: [{ section: "a", bars: 8 }], loop: true });
  });

  it("accepts keywords as track names", () => {
    const names = program("sine: kick x...\nloop: hat x.\ntempo: kick x\nx: kick x\nb2: bass c2").tracks.map((found) => found.name);
    expect(names).toEqual(["sine", "loop", "tempo", "x", "b2"]);
  });

  it("reads a key and a chromatic scale", () => {
    expect(program("key f# dorian\nkick x").key).toEqual({ tonic: 6, scale: "dorian" });
    expect(program("key eb chromatic\nkick x").key).toEqual({ tonic: 3, scale: "chromatic" });
  });
});

describe("analyze never throws", () => {
  const alphabet = "abcxX.~[]?*/|:,()-0123456789 \n\r\tCmsinetrolpkh#";
  const soup = fc.string({ unit: fc.constantFrom(...alphabet), maxLength: 120 });

  it("on token soup", () => {
    fc.assert(
      fc.property(soup, (source) => {
        const result = analyze(source, registry);
        expect(typeof result.ok).toBe("boolean");
        if (!result.ok) expect(result.internalError).toBeUndefined();
      }),
      { numRuns: 500 },
    );
  });

  it("on arbitrary text", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (source) => {
        const result = analyze(source, registry);
        if (!result.ok) expect(result.internalError).toBeUndefined();
      }),
      { numRuns: 300 },
    );
  });
});
