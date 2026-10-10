// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { parseManifest, presetOf } from "./manifest";
import { createRegistry, instrumentId, instrumentNames } from "./registry";

const BASS_FIXTURE = {
  name: "bass",
  group: "bass",
  kind: "pitched",
  range: { lowest: "c1", highest: "c4" },
  engine: "legacy",
  description: "Saw bass with a plucked filter",
  tags: ["bass", "saw"],
  voices: 2,
  allocation: "poly",
  steal: "oldest",
  costPerVoice: 1.4,
  patterns: [
    { name: "Dotted", text: "c2 . . c2 . . c2 ." },
    { name: "Long notes", text: "c2 ~ ~ ~" },
  ],
  preview: ". c2 . c2 . c2 . eb2",
  defaultDuck: 0.6,
  parameters: [
    { name: "cutoff", min: 40, max: 8000, default: 600, unit: "Hz", curve: "exponential" },
    { name: "decay", min: 0.05, max: 2, default: 0.3, unit: "s", curve: "exponential" },
    { name: "drive", min: 0, max: 1, default: 0.1, unit: "", curve: "linear" },
  ],
  tone: [{ parameter: "cutoff", from: 120, to: 3000 }],
  presets: [
    { name: "round", description: "Round and warm", values: {} },
    { name: "bright", description: "Brighter filter", values: { cutoff: 1500 } },
  ],
  defaultPreset: "round",
} as const;

/** An instrument on an engine table, with a choice parameter. */
const ACID_FIXTURE = {
  ...BASS_FIXTURE,
  name: "acid",
  engine: "va",
  voices: 1,
  allocation: "mono",
  parameters: [
    { name: "cutoff", min: 40, max: 12000, default: 700, unit: "Hz", curve: "exponential" },
    { name: "wave", choices: ["saw", "square"], default: "saw" },
  ],
  tone: [{ parameter: "cutoff", from: 150, to: 6000 }],
  presets: [
    { name: "classic", description: "The classic squelch", values: {} },
    { name: "square", description: "Hollow square", values: { wave: "square" } },
  ],
  defaultPreset: "classic",
} as const;

function withField(base: object, path: readonly (string | number)[], value: unknown): unknown {
  const copy = structuredClone(base) as Record<string, unknown>;
  let target: Record<string | number, unknown> = copy;
  for (const segment of path.slice(0, -1)) target = target[segment] as Record<string | number, unknown>;
  target[path[path.length - 1] as string | number] = value;
  return copy;
}

function issuePaths(json: unknown): readonly string[] {
  const result = parseManifest(json);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

describe("parseManifest", () => {
  it("accepts a valid manifest and normalises it", () => {
    const result = parseManifest(BASS_FIXTURE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.parameters[0]).toEqual({ ...BASS_FIXTURE.parameters[0], choices: null });
    expect(result.manifest.scene).toBeNull();
    expect(result.manifest.model).toBeNull();
    const named = parseManifest({ ...BASS_FIXTURE, model: "FLUX B24" });
    expect(named.ok && named.manifest.model).toBe("FLUX B24");
    expect(presetOf(result.manifest, "bright")?.values).toEqual({ cutoff: 1500 });
    expect(presetOf(result.manifest, null)?.name).toBe("round");
  });

  it("reads the named patterns and derives the default pattern from the first", () => {
    const result = parseManifest(BASS_FIXTURE);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.manifest.patterns.map((pattern) => pattern.name)).toEqual(["Dotted", "Long notes"]);
    expect(result.manifest.defaultPattern).toBe("c2 . . c2 . . c2 .");
    const seven = Array.from({ length: 7 }, (_, index) => ({ name: `P${index}`, text: "c2" }));
    expect(parseManifest({ ...BASS_FIXTURE, patterns: seven }).ok).toBe(false);
  });

  it("reads the pitch range of a pitched or chord instrument as MIDI notes", () => {
    const result = parseManifest(BASS_FIXTURE);
    expect(result.ok && result.manifest.range).toEqual({ lowest: 24, highest: 60 });
    const drum = parseManifest({ ...BASS_FIXTURE, kind: "drum", range: undefined });
    expect(drum.ok && drum.manifest.range).toBeNull();
  });
  it.each([
    ["missing on a pitched instrument", undefined, "range"],
    ["a word that is not a note", { lowest: "low", highest: "c4" }, "range.lowest"],
    ["less than two octaves", { lowest: "c2", highest: "b3" }, "range"],
  ])("rejects a range %s", (_, range, path) => {
    expect(issuePaths({ ...BASS_FIXTURE, range })).toEqual([path]);
  });
  it("rejects a range on a drum instrument", () => {
    expect(issuePaths({ ...BASS_FIXTURE, kind: "drum" })).toEqual(["range"]);
  });
  it("turns a choice parameter into an index range, and a choice preset into its index", () => {
    const result = parseManifest(ACID_FIXTURE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.parameters[1]).toEqual({
      name: "wave",
      min: 0,
      max: 1,
      default: 0,
      unit: "",
      curve: "linear",
      choices: ["saw", "square"],
    });
    expect(presetOf(result.manifest, "square")?.values).toEqual({ wave: 1 });
    // A normalised manifest parses again to itself (createRegistry validates twice).
    expect(parseManifest(result.manifest)).toEqual(result);
  });

  it("rejects what is not an object", () => {
    expect(issuePaths(null)).toEqual([""]);
    expect(issuePaths([])).toEqual([""]);
  });

  it.each([
    [["name"], "Bass", "name"],
    [["name"], "a-name-that-is-far-too-long", "name"],
    [["group"], "synth", "group"],
    [["kind"], "loop", "kind"],
    [["voices"], 0, "voices"],
    [["voices"], 33, "voices"],
    [["voices"], 1.5, "voices"],
    [["allocation"], "mono", "allocation"],
    [["steal"], "newest", "steal"],
    [["engine"], "wavetable", "engine"],
    [["description"], "short", "description"],
    [["tags"], ["Bass"], "tags"],
    [["costPerVoice"], 0, "costPerVoice"],
    [["patterns"], [], "patterns"],
    [["patterns"], "x...", "patterns"],
    [["patterns", 0, "text"], "", "patterns[0].text"],
    [["patterns", 0, "text"], "x".repeat(1025), "patterns[0].text"],
    [["patterns", 0, "name"], "", "patterns[0].name"],
    [["patterns", 0, "name"], "A name that is far too long", "patterns[0].name"],
    [["patterns", 1, "name"], "Dotted", "patterns[1].name"],
    [["preview"], "x".repeat(257), "preview"],
    [["defaultDuck"], 1.5, "defaultDuck"],
    [["parameters"], "cutoff", "parameters"],
    [["parameters", 0, "min"], 9000, "parameters[0].max"],
    [["parameters", 0, "default"], 9000, "parameters[0].default"],
    [["parameters", 2, "curve"], "log", "parameters[2].curve"],
    [["parameters", 2, "curve"], "exponential", "parameters[2].min"],
    [["parameters", 1, "name"], "gain", "parameters[1].name"],
    [["parameters", 1, "name"], "lowpass", "parameters[1].name"],
    [["parameters", 1, "name"], "legato", "parameters[1].name"],
    [["parameters", 1, "name"], "cutoff", "parameters[1].name"],
    [["parameters", 1, "unit"], 3, "parameters[1].unit"],
    [["tone", 0, "parameter"], "resonance", "tone[0].parameter"],
    [["tone", 0, "to"], 9000, "tone[0].to"],
    [["presets"], [], "presets"],
    [["presets", 1, "name"], "xylo", "presets[1].name"],
    [["presets", 1, "name"], "eb", "presets[1].name"],
    [["presets", 1, "name"], "a", "presets[1].name"],
    [["presets", 1, "name"], "round", "presets[1].name"],
    [["presets", 1, "values"], { cutoff: 9000 }, "presets[1].values.cutoff"],
    [["presets", 1, "values"], { resonance: 0.5 }, "presets[1].values.resonance"],
    [["presets", 0, "values"], { cutoff: 900 }, "defaultPreset"],
    [["defaultPreset"], "missing", "defaultPreset"],
    [["model"], "X", "model"],
    [["model"], "AURA Grand Piano Deluxe", "model"],
    [["model"], "AURA_Grand", "model"],
  ] as const)("rejects %j = %j", (path, value, expectedPath) => {
    expect(issuePaths(withField(BASS_FIXTURE, path, value))).toContain(expectedPath);
  });

  it("keeps the legacy engine for kick, hat and bass only", () => {
    expect(issuePaths({ ...BASS_FIXTURE, name: "lead" })).toContain("engine");
    expect(issuePaths(BASS_FIXTURE)).toEqual([]);
  });

  it.each([
    ["an unknown parameter of the engine", ["parameters", 0, "name"], "warp", "parameters[0].name"],
    ["a widened range", ["parameters", 0, "max"], 22000, "parameters[0].min"],
    ["a different unit", ["parameters", 0, "unit"], "kHz", "parameters[0].unit"],
    ["a different curve", ["parameters", 0, "curve"], "linear", "parameters[0].curve"],
    ["choices out of order", ["parameters", 1, "choices"], ["square", "saw"], "parameters[1].choices"],
    ["choices outside the engine", ["parameters", 1, "choices"], ["saw", "noise"], "parameters[1].choices"],
    ["a default outside the choices", ["parameters", 1, "default"], "sine", "parameters[1].default"],
    ["a preset choice outside the list", ["presets", 1, "values"], { wave: "sine" }, "presets[1].values.wave"],
  ] as const)("checks the engine table: %s", (_, path, value, expectedPath) => {
    expect(issuePaths(withField(ACID_FIXTURE, path, value))).toContain(expectedPath);
  });

  it("lets any continuous parameter narrow its range (the noise cutoff)", () => {
    const noise = withField(ACID_FIXTURE, ["parameters", 0], {
      name: "cutoff",
      min: 40,
      max: 16000,
      default: 4000,
      unit: "Hz",
      curve: "exponential",
    });
    expect(issuePaths(noise)).toEqual([]);
  });
});

describe("createRegistry", () => {
  const hat = { ...BASS_FIXTURE, name: "hat", kind: "drum", group: "drums", range: undefined } as const;
  const kick = { ...BASS_FIXTURE, name: "kick", kind: "drum", group: "drums", range: undefined } as const;

  it("orders by name: the position is the instrumentId", () => {
    const registry = createRegistry([kick, BASS_FIXTURE, hat].map((json) => {
      const result = parseManifest(json);
      if (!result.ok) throw new Error("fixture");
      return result.manifest;
    }));
    expect(instrumentNames(registry)).toEqual(["bass", "hat", "kick"]);
    expect(instrumentId(registry, "kick")).toBe(2);
    expect(instrumentId(registry, "clap")).toBeNull();
    expect(registry.get("hat")?.kind).toBe("drum");
  });

  it("throws on a duplicate, an invalid manifest or names that collide as modules", () => {
    const parsed = (json: unknown) => {
      const result = parseManifest(json);
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      return result.manifest;
    };
    const bass = parsed(BASS_FIXTURE);
    expect(() => createRegistry([bass, bass])).toThrow(/Duplicate/);
    expect(() => createRegistry([{ ...bass, voices: 0 }])).toThrow(/voices/);
    const acid = parsed(ACID_FIXTURE);
    expect(() => createRegistry([{ ...acid, name: "fm-bass" }, { ...acid, name: "fm_bass" }])).toThrow(/collide/);
  });
});
