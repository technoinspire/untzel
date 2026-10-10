// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { EFFECT_PARAMETERS, INSTRUMENT_PARAMETER_OFFSET, rational, type Program, type Track } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { manifests } from "@untzel/instrument-index";
import { analyze } from "./read/analyze";

// The language of the instrument library.

const registry = registryWith();

function program(source: string): Program {
  const result = analyze(source, registry);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  expect(result.warnings).toEqual([]);
  return result.program;
}

function track(source: string, name?: string): Track {
  const read = program(source);
  const found = name === undefined ? read.tracks[0] : read.tracks.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error("no track");
  return found;
}

function codes(source: string): readonly string[] {
  const result = analyze(source, registry);
  return (result.ok ? result.warnings : result.diagnostics).map((diagnostic) => diagnostic.code);
}

function value(read: Track, name: string): unknown {
  return read.parameters.find((parameter) => parameter.name === name)?.value;
}

describe("the library registry", () => {
  // The index equals the folders of instruments/ (packages/instrument-index, index.test.ts):
  // a number written here would be one more list to edit for every new instrument.
  it("has every instrument of the index and at least 145 named sounds", () => {
    expect(registry.size).toBe(manifests.length);
    const sounds = [...registry.values()].reduce((sum, manifest) => sum + manifest.presets.length, 0);
    expect(sounds).toBeGreaterThanOrEqual(145);
  });

  it.each([...registryWith().values()].map((manifest) => [manifest.name, manifest] as const))(
    "%s: the default pattern and the preview analyze with zero diagnostics",
    (name, manifest) => {
      for (const pattern of [manifest.defaultPattern, manifest.preview]) {
        const result = analyze(`t: ${name} ${pattern}`, registry);
        expect(result.ok ? result.warnings : result.diagnostics).toEqual([]);
      }
      for (const preset of manifest.presets) {
        const result = analyze(`t: ${name} ${preset.name} ${manifest.defaultPattern}`, registry);
        expect(result.ok ? result.warnings : result.diagnostics).toEqual([]);
      }
    },
  );
});

describe("named sounds", () => {
  it("resolves default → sound → tone → explicit", () => {
    const bright = track("p: piano bright c3");
    expect(bright.preset).toBe("bright");
    expect(value(bright, "hardness")).toEqual({ kind: "constant", value: 0.95 });
    expect(value(track("p: piano c3"), "hardness")).toEqual({ kind: "constant", value: 0.5 });
    // tone moves brightness over 0.1..0.9 and wins over the sound.
    expect(value(track("p: piano bright c3 | tone 0"), "brightness")).toEqual({ kind: "constant", value: 0.1 });
    expect(value(track("p: piano bright c3 | hardness 0.2"), "hardness")).toEqual({ kind: "constant", value: 0.2 });
  });

  it("reads the default sound written out as no sound", () => {
    expect(track("p: piano grand c3").preset).toBeNull();
  });

  it("sets a choice from a sound and from a modifier", () => {
    const wave = INSTRUMENT_PARAMETER_OFFSET + 3;
    expect(track("a: acid square c2").parameters.find((p) => p.index === wave)?.value).toEqual({ kind: "constant", value: 1 });
    expect(value(track("l: lead c4 | wave triangle"), "wave")).toEqual({ kind: "constant", value: 2 });
  });

  it("names an unknown sound and keeps keywords out of instruments", () => {
    const result = analyze("p: piano brigth c3", registry);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.message).toBe('"piano" has no sound "brigth". Did you mean "bright"?');
    expect(codes("tempo fast")).toEqual(["SYNTAX_ERROR"]);
    expect(codes("swing loose")).toEqual(["SYNTAX_ERROR"]);
    expect(codes("kick x...\nsection drop | gain 0.8")).toEqual(["SYNTAX_ERROR"]);
  });
});

describe("patterns", () => {
  it("accents the last step of hits, a note, a stack and a group", () => {
    expect(codes("hat ..x! x.x.!")).toEqual(["OUT_OF_RANGE"]);
    expect(codes("hat ..x!")).toEqual([]);
    expect(codes("kick .! x")).toEqual(["OUT_OF_RANGE"]);
    expect(codes("kick ~! x")).toEqual(["OUT_OF_RANGE"]);
    expect(codes("p: piano c3! c3+e3! Cm7! [c3 e3]!")).toEqual([]);
  });

  it("reads a stack and only lets chord instruments play it", () => {
    expect(codes("p: pad c3+eb3+g3 ~ ~ ~")).toEqual([]);
    expect(codes("b: bass c2+g2")).toEqual(["PATTERN_KIND_MISMATCH"]);
    expect(codes("p: pad c3+e3+g3+b3+d4+f4+a4+c5+e5")).toEqual(["OUT_OF_RANGE"]);
  });

  it("accepts the new chord qualities", () => {
    expect(codes("p: pad Cmaj9 Am7b5 G7sus4 Fadd9 Dm11 C13 Eaug Bdim7")).toEqual([]);
  });
});

describe("modifiers of the library", () => {
  it("reads velocity, glide and legato on a mono instrument", () => {
    const lead = track("l: lead c4 | velocity 0.6 | glide 0.08 | legato");
    expect(lead.velocity).toBe(0.6);
    expect(lead.legato).toBe(true);
    expect(value(lead, "glide")).toEqual({ kind: "constant", value: 0.08 });
    expect(value(lead, "legato")).toEqual({ kind: "constant", value: 1 });
  });

  it("warns that legato, voicing and arp-rate have no effect where they cannot apply", () => {
    expect(codes("p: piano c3 | legato")).toEqual(["NO_EFFECT"]);
    expect(codes("l: lead c4 | voicing open")).toEqual(["NO_EFFECT"]);
    expect(codes("p: piano Cm7 | arp-rate 1/8")).toEqual(["NO_EFFECT"]);
  });

  it("reads voicing, inversion and the arpeggiator", () => {
    const pad = track("p: pad Cm7 | voicing drop2 | inversion 1 | arp updown | arp-rate 1/8 | arp-octaves 2");
    expect(pad.voicing).toBe("drop2");
    expect(pad.inversion).toBe(1);
    expect(pad.arp).toEqual({ mode: "updown", rate: rational(1n, 8n), octaves: 2 });
    expect(codes("p: pad Cm7 | arp sideways")).toEqual(["UNKNOWN_CHOICE"]);
    expect(codes("p: pad Cm7 | arp up | arp-rate 1/5")).toEqual(["OUT_OF_RANGE"]);
  });

  it("orders the effects as written, by the first of their modifiers", () => {
    const bass = track("b: bass c2 | distort 0.4 | lowpass 900 | eq-high 2 | lowpass-q 0.5 | eq-low -3");
    expect(bass.effects).toEqual(["distort", "lowpass", "eq"]);
    const lowpass = EFFECT_PARAMETERS.findIndex((parameter) => parameter.name === "lowpass");
    expect(bass.parameters.find((parameter) => parameter.index === 16 + lowpass)?.value).toEqual({ kind: "constant", value: 900 });
    // The last one wins: the order follows the surviving modifier.
    const repeated = analyze("b: bass c2 | lowpass 900 | distort 0.4 | lowpass 600", registry);
    expect(repeated.ok && repeated.program.tracks[0]?.effects).toEqual(["distort", "lowpass"]);
  });
});

describe("signals", () => {
  it("runs a period below one bar in the DSP and the rest in the transport", () => {
    const fast = track("b: bass c2 | cutoff sine(1/8) 300..900");
    expect(fast.modulators).toEqual([
      { kind: "lfo", index: INSTRUMENT_PARAMETER_OFFSET, shape: "sine", periodBars: rational(1n, 8n), from: 300, to: 900, curve: "exponential" },
    ]);
    expect(value(fast, "cutoff")).toEqual({ kind: "constant", value: 300 });
    expect(track("b: bass c2 | cutoff sine(0.5) 300..900").modulators).toHaveLength(1);
    expect(track("b: bass c2 | cutoff sine(3/4) 300..900").modulators).toHaveLength(1);
    const slow = track("b: bass c2 | cutoff sine(2/1) 300..900");
    expect(slow.modulators).toEqual([]);
    expect((value(slow, "cutoff") as { kind: string }).kind).toBe("signal");
    expect(codes("b: bass c2 | cutoff sine(1/128) 300..900")).toEqual(["OUT_OF_RANGE"]);
  });

  it("keeps rand in the transport and needs a multiple of 1/16 below a bar", () => {
    expect(track("b: bass c2 | cutoff rand(1/8) 300..900").modulators).toEqual([]);
    expect(codes("b: bass c2 | cutoff rand(1/12) 300..900")).toEqual(["OUT_OF_RANGE"]);
  });

  it("reads a per-note envelope", () => {
    expect(track("b: bass c2 | cutoff env(0.3) 300..4000").modulators).toEqual([
      { kind: "envelope", index: INSTRUMENT_PARAMETER_OFFSET, seconds: 0.3, from: 300, to: 4000, curve: "exponential" },
    ]);
    expect(codes("b: bass c2 | cutoff env(20) 300..4000")).toEqual(["OUT_OF_RANGE"]);
    expect(codes("b: bass c2 | cutoff env(0.3)")).toEqual(["SIGNAL_NEEDS_RANGE"]);
  });

  it("refuses a fast signal on duck and the sends", () => {
    expect(codes("b: bass c2 | duck sine(1/8) 0..1")).toEqual(["OUT_OF_RANGE"]);
    expect(codes("b: bass c2 | gain sine(1/8) 0.2..0.8")).toEqual([]);
  });
});

describe("the loop section", () => {
  it("marks one section as the loop", () => {
    const read = program("kick x...\nhat ..x.\nsection groove kick hat | loop\nsection drop kick");
    expect(read.sections.map((section) => section.isLoop)).toEqual([true, false]);
    expect(codes("kick x...\nsection a kick | loop 2")).toEqual(["OUT_OF_RANGE"]);
    expect(codes("kick x...\nsection a kick | loop\nsection b kick | loop")).toEqual(["DUPLICATE_LOOP_SECTION"]);
  });
});
