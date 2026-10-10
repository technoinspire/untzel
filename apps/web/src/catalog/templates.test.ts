// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The template library. One test runs over every .untzel file in the folder, so a new
// file is covered without touching this one: header, style folder with a style.json, zero
// diagnostics against the real registry and a sound on every track. Then the music each
// template promises.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toNumber, type Program, type Track } from "@untzel/core";
import { analyze } from "@untzel/language";
import { firstTouchTemplate, readTemplateTree } from "@untzel/sim/template-tree";
import { parseStyleFile, parseTemplateHeader, templateIdOf } from "@untzel/templates";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";

const { registry } = buildRegistry();
const ROOT = new URL("../templates/", import.meta.url);
const library = readTemplateTree(fileURLToPath(new URL("../../../../", import.meta.url)));
const FIRST_TOUCH = firstTouchTemplate(library).id;

/** Every .untzel on disk, by path relative to the folder: what the catalog keeps or drops. */
const TEMPLATE_PATHS: readonly string[] = readdirSync(ROOT, { recursive: true, encoding: "utf8" })
  .filter((path) => path.endsWith(".untzel"))
  .map((path) => path.split("\\").join("/"))
  .sort();
const textAt = (path: string): string => readFileSync(new URL(path, ROOT), "utf8");
const textOf = (id: string): string => textAt(`${id}.untzel`);

function programOf(id: string): Program {
  const result = analyze(textOf(id), registry);
  if (!result.ok) throw new Error(`${id}: ${result.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`);
  // A template without tracks (Blank) says so with NOTHING_TO_PLAY; nothing else warns.
  const expected = result.program.tracks.length === 0 ? ["NOTHING_TO_PLAY"] : [];
  expect(result.warnings.map((warning) => warning.code), `${id} has warnings`).toEqual(expected);
  return result.program;
}

/** The line of a track as written, without the comment. */
const lineOf = (source: string, track: Track): string => source.slice(track.source.from, track.source.to);

/** The word after the instrument, when it is one of the instrument's sounds. */
function writtenSound(source: string, track: Track): string | null {
  const words = lineOf(source, track).replace(/^[a-z0-9_-]+:\s*/, "").split(/\s+/);
  const sound = words[1] ?? "";
  return registry.get(track.instrument)?.presets.some((preset) => preset.name === sound) === true ? sound : null;
}

const songBars = (program: Program): number => program.song?.parts.reduce((bars, part) => bars + part.bars, 0) ?? 0;

function trackOf(program: Program, name: string): Track {
  const track = program.tracks.find((candidate) => candidate.name === name);
  if (track === undefined) throw new Error(`no track ${name}`);
  return track;
}

/** The steps of each bar of a track as written: "x... x..." → [["x...", ...]] split per step. */
function barsOf(source: string, track: Track): string[][] {
  const pattern = lineOf(source, track).split("|")[0]?.replace(/^[a-z0-9_-]+:\s*\S+\s+\S+\s*/, "") ?? "";
  return pattern.split("/").map((bar) => bar.trim().split(/\s+/));
}

describe("every template file", () => {
  it.each(TEMPLATE_PATHS)("%s has the header, a style folder with a style.json, zero diagnostics and a sound on every track", (path) => {
    expect(parseTemplateHeader(textAt(path)), `${path} header`).not.toBeNull();
    const id = templateIdOf(path);
    const folder = id.includes("/") ? id.split("/")[0] : null;
    if (folder === null) expect(library.starters.map((starter) => starter.id), `${path} sits at the root`).toContain(id);
    else expect(parseStyleFile(textAt(`${folder}/style.json`)), `${folder}/style.json`).not.toBeNull();
    const program = programOf(id);
    const source = textOf(id);
    for (const track of program.tracks) expect(writtenSound(source, track), `${id}: ${track.name}`).not.toBeNull();
  });

  it("the catalog keeps every file and reports nothing", () => {
    expect(library.problems).toEqual([]);
    expect([...library.projects, ...library.starters].map((template) => template.id).sort()).toEqual(TEMPLATE_PATHS.map(templateIdOf));
  });
});

describe("the library", () => {
  it("has one style per folder, in style.json order (the picker lists them alphabetically)", () => {
    expect(library.styles.map((style) => style.label)).toEqual([
      "Melodic techno", "Afro house", "Indie dance", "House", "Psytrance", "Trance", "Deep house", "Downtempo", "Acid techno", "Tech house", "Amapiano", "Hip hop",
    ]);
  });

  it("names every project, in each style's order", () => {
    expect(library.projects.map((project) => `${project.id} = ${project.name}`)).toEqual([
      "melodic-techno/midnight-bloom = Midnight Bloom",
      "melodic-techno/night-petals = Night Petals",
      "melodic-techno/after-hours = After Hours",
      "afro-house/red-earth = Red Earth",
      "indie-dance/coastline = Coastline",
      "house/sunday-piano = Sunday Piano",
      "house/disco-lights = Disco Lights",
      "house/golden-hour = Golden Hour",
      "psytrance/full-moon = Full Moon",
      "trance/eternal-horizon = Eternal Horizon",
      "deep-house/night-garden = Night Garden",
      "downtempo/blue-lounge = Blue Lounge",
      "acid-techno/warehouse = Warehouse",
      "tech-house/low-ceiling = Low Ceiling",
      "amapiano/velvet-rooftop = Velvet Rooftop",
      "hip-hop/crate-digger = Crate Digger",
    ]);
  });

  it("declares one first-touch template, and keeps the blank one at the root, order 0, with no track", () => {
    expect(TEMPLATE_PATHS.filter((path) => parseTemplateHeader(textAt(path))?.isDefault === true)).toHaveLength(1);
    expect(library.firstTouch).toBe(FIRST_TOUCH);
    expect(library.starters.map((starter) => [starter.id, starter.order])).toEqual([["blank", 0]]);
    expect(programOf("blank").tracks).toEqual([]);
  });

  it("the first-touch template, afro, the house projects, the trance styles and warehouse are full songs; night-garden and blue-lounge are loops", () => {
    for (const project of library.projects.filter((candidate) => !["deep-house/night-garden", "downtempo/blue-lounge"].includes(candidate.id))) {
      expect(programOf(project.id).song, project.id).not.toBeNull();
    }
    for (const id of ["deep-house/night-garden", "downtempo/blue-lounge"]) {
      const program = programOf(id);
      expect(program.song, id).toBeNull();
      expect(program.sections, id).toEqual([]);
    }
  });

  it("night-garden: 115 BPM, a loop of 7 tracks; blue-lounge: 96 BPM, a loop of 9; warehouse: 138 with acid", () => {
    // The tempos spread out and each loop gained its signature source.
    const garden = programOf("deep-house/night-garden");
    expect([toNumber(garden.tempo), garden.tracks.length]).toEqual([115, 7]);
    const lounge = programOf("downtempo/blue-lounge");
    expect([toNumber(lounge.tempo), lounge.tracks.length]).toEqual([96, 9]);
    const warehouse = programOf("acid-techno/warehouse");
    expect(toNumber(warehouse.tempo)).toBe(138);
    expect(warehouse.tracks.map((track) => track.instrument)).toContain("acid");
  });
});

describe("full moon (psytrance)", () => {
  const program = programOf("psytrance/full-moon");
  const source = textOf("psytrance/full-moon");

  it("is full-on at 145 BPM in F# phrygian, with a short kick tuned near F#1", () => {
    expect([toNumber(program.tempo), program.key]).toEqual([145, { tonic: 6, scale: "phrygian" }]);
    expect(lineOf(source, trackOf(program, "kick"))).toMatch(/\| pitch 46 \| decay 0\.1\d/);
  });

  it("rolls the bass on the three 16ths after each kick, never on it, and climbs to G and A every 4th bar", () => {
    const bars = barsOf(source, trackOf(program, "bass"));
    expect(bars).toHaveLength(4);
    for (const bar of bars) {
      expect(bar.filter((_, index) => index % 4 === 0).every((step) => step === "."), bar.join(" ")).toBe(true);
      expect(bar.filter((_, index) => index % 4 !== 0).every((step) => step !== ".")).toBe(true);
    }
    expect(bars[3]?.join(" ")).toMatch(/g1.*a1/);
  });

  it("opens a resonant 16th acid over 16 bars, and has the psytrance screamer lead in the drop with delayed zaps", () => {
    expect(lineOf(source, trackOf(program, "acid"))).toMatch(/\| cutoff saw\(16\) .*\| resonance 0\.\d/);
    expect(writtenSound(source, trackOf(program, "lead"))).toBe("screamer");
    expect(program.sections.find((section) => section.name === "drop")?.tracks).toEqual(expect.arrayContaining(["lead", "zap"]));
    expect(lineOf(source, trackOf(program, "zap"))).toMatch(/\| delay 3\/16/);
  });
});

describe("eternal horizon (trance)", () => {
  const program = programOf("trance/eternal-horizon");
  const source = textOf("trance/eternal-horizon");

  it("is uplifting trance at 138 BPM in D minor over i–VI–III–V", () => {
    expect([toNumber(program.tempo), program.key]).toEqual([138, { tonic: 2, scale: "minor" }]);
    expect(barsOf(source, trackOf(program, "pad")).map((bar) => bar[0])).toEqual(["Dm", "Bb", "F", "A"]);
  });

  it("writes the lead in harmonic minor, so every melodic track is free", () => {
    expect(lineOf(source, trackOf(program, "lead"))).toMatch(/c#5/);
    for (const name of ["gate", "pad", "saws", "arp", "lead", "piano", "strings", "choir"]) expect(trackOf(program, name).free, name).toBe(true);
  });

  it("has an offbeat bass, a long breakdown with piano, strings and choir, an 8-bar snare roll and a supersaw drop", () => {
    for (const bar of barsOf(source, trackOf(program, "bass"))) expect(bar.map((step, index) => (step === "." ? "" : String(index))).filter(Boolean)).toEqual(["2", "6", "10", "14"]);
    expect(program.sections.find((section) => section.name === "break")?.tracks).toEqual(expect.arrayContaining(["piano", "strings", "choir"]));
    expect(barsOf(source, trackOf(program, "roll"))).toHaveLength(8);
    expect(program.sections.find((section) => section.name === "drop")?.tracks).toContain("saws");
    expect(program.song?.parts.find((part) => part.section === "break")?.bars).toBe(32);
  });
});

describe("red earth (afro house)", () => {
  const program = programOf("afro-house/red-earth");
  const source = textOf("afro-house/red-earth");
  const instruments = new Set(program.tracks.map((track) => track.instrument));

  it("is a 121 BPM modal minor song of 185 to 215 bars that loops its groove", () => {
    // 121, not 123: the templates' tempos are spread out.
    expect(toNumber(program.tempo)).toBe(121);
    expect(["dorian", "minor"]).toContain(program.key.scale);
    expect(songBars(program)).toBeGreaterThanOrEqual(185);
    expect(songBars(program)).toBeLessThanOrEqual(215);
    expect(program.sections.filter((section) => section.isLoop).map((section) => section.name)).toEqual(["groove"]);
  });

  it("is led by hand percussion and tonal motifs, with a chant", () => {
    for (const name of ["conga", "bongo", "djembe", "woodblock", "shaker", "kalimba", "mallet", "choir", "vox", "pad", "stab", "sub"]) {
      expect(instruments.has(name), name).toBe(true);
    }
    expect(program.tracks.filter((track) => track.swing !== null).length).toBeGreaterThanOrEqual(4);
    expect(source).toMatch(/x\?0\.\d/);
    expect(source).toMatch(/\bsine\(/);
  });

  it("starts and ends on percussion only", () => {
    const percussion = new Set(["shaker", "conga", "bongo", "djembe", "woodblock", "tom"]);
    for (const name of ["intro", "outro"]) {
      const section = program.sections.find((entry) => entry.name === name);
      const tracks = section?.tracks.map((track) => program.tracks.find((entry) => entry.name === track)?.instrument ?? "") ?? [];
      expect(tracks.every((instrument) => percussion.has(instrument)), name).toBe(true);
    }
  });
});

describe("velvet rooftop (amapiano)", () => {
  const program = programOf("amapiano/velvet-rooftop");
  const source = textOf("amapiano/velvet-rooftop");
  const instruments = new Set(program.tracks.map((track) => track.instrument));

  it("is a 113 BPM song in f minor of 160 to 200 bars that loops its groove", () => {
    expect([toNumber(program.tempo), program.key]).toEqual([113, { tonic: 5, scale: "minor" }]);
    expect(songBars(program)).toBeGreaterThanOrEqual(160);
    expect(songBars(program)).toBeLessThanOrEqual(200);
    expect(program.sections.filter((section) => section.isLoop).map((section) => section.name)).toEqual(["groove"]);
  });

  it("knocks a log drum under jazz piano and swung recorded percussion, and opens without the kick", () => {
    for (const name of ["fm-bass", "piano", "shaker", "woodblock", "bongo", "conga", "hat", "clap", "vox"]) expect(instruments.has(name), name).toBe(true);
    expect(lineOf(source, trackOf(program, "log"))).toMatch(/\| brightness env\(/);
    expect(program.tracks.filter((track) => track.swing !== null).length).toBeGreaterThanOrEqual(6);
    expect(program.sections.find((section) => section.name === "intro")?.tracks).not.toContain("kick");
  });
});

describe("low ceiling (tech house)", () => {
  const program = programOf("tech-house/low-ceiling");
  const source = textOf("tech-house/low-ceiling");
  const instruments = new Set(program.tracks.map((track) => track.instrument));

  it("is a 126 BPM song in g minor of 160 to 200 bars that loops its groove", () => {
    expect([toNumber(program.tempo), program.key]).toEqual([126, { tonic: 7, scale: "minor" }]);
    expect(songBars(program)).toBeGreaterThanOrEqual(160);
    expect(songBars(program)).toBeLessThanOrEqual(200);
    expect(program.sections.filter((section) => section.isLoop).map((section) => section.name)).toEqual(["groove"]);
  });

  it("rolls a reese bass with a per-note filter under swung hats and hand percussion, and a voice through a square-wave vowel", () => {
    const bass = trackOf(program, "bass");
    expect(bass.instrument).toBe("reese");
    expect(lineOf(source, bass)).toMatch(/\| cutoff env\(/);
    for (const name of ["hat", "shaker", "tom", "slap", "conga"]) expect(trackOf(program, name).swing, name).not.toBeNull();
    for (const name of ["conga", "clap", "hat", "shaker", "vox"]) expect(instruments.has(name), name).toBe(true);
    expect(lineOf(source, trackOf(program, "vox"))).toMatch(/\| vowel square\(/);
  });
});

describe("crate digger (hip hop)", () => {
  const program = programOf("hip-hop/crate-digger");
  const source = textOf("hip-hop/crate-digger");
  const instruments = new Set(program.tracks.map((track) => track.instrument));

  it("is boom bap in d minor under a global swing, one tempo from start to end, 80 to 110 bars, looping the verse", () => {
    expect(toNumber(program.tempo)).toBeGreaterThanOrEqual(88);
    expect(toNumber(program.tempo)).toBeLessThanOrEqual(95);
    expect(program.key).toEqual({ tonic: 2, scale: "minor" });
    expect(toNumber(program.swing)).toBeGreaterThan(0);
    for (const section of program.sections) expect(section.tempo, section.name).toBeNull();
    expect(songBars(program)).toBeGreaterThanOrEqual(80);
    expect(songBars(program)).toBeLessThanOrEqual(110);
    expect(program.sections.filter((section) => section.isLoop).map((section) => section.name)).toEqual(["verse"]);
  });

  it("chops a crushed piano sample over ghost snares, with recorded strings, choir, voice, hat and clap", () => {
    for (const name of ["piano", "strings", "choir", "vox", "hat", "clap"]) expect(instruments.has(name), name).toBe(true);
    expect(lineOf(source, trackOf(program, "snare"))).toMatch(/x\?0\./);
    expect(lineOf(source, trackOf(program, "sample"))).toMatch(/\| crush /);
  });
});

describe("the first-touch template, Midnight Bloom", () => {
  const program = programOf(FIRST_TOUCH);
  const source = textOf(FIRST_TOUCH);
  const byName = new Map(program.tracks.map((track) => [track.name, track]));
  const has = (name: string): Track => {
    const track = byName.get(name);
    if (track === undefined) throw new Error(`${FIRST_TOUCH} has no ${name}`);
    return track;
  };

  it("is a 124 BPM song in a minor key, 190 to 220 bars, with at least 16 named tracks", () => {
    expect(toNumber(program.tempo)).toBe(124);
    expect(program.key.scale).toBe("minor");
    expect(program.tracks.length).toBeGreaterThanOrEqual(16);
    for (const track of program.tracks) expect(lineOf(source, track), track.name).toMatch(/^[a-z][a-z0-9_-]*:/);
    expect(songBars(program)).toBeGreaterThanOrEqual(190);
    expect(songBars(program)).toBeLessThanOrEqual(220);
  });

  it("uses every instrument the request names", () => {
    const instruments = new Set(program.tracks.map((track) => track.instrument));
    for (const name of ["kick", "sub", "bass", "hat", "shaker", "conga", "rim", "perc", "clap", "pad", "pluck", "epiano", "lead", "choir", "noise", "riser", "downlifter", "impact"]) {
      expect(instruments.has(name), name).toBe(true);
    }
  });

  it("writes sine and saw signals, swing, probability, three insert effects and both sends", () => {
    expect(source).toMatch(/\bsine\(/);
    expect(source).toMatch(/\bsaw\(/);
    expect(program.tracks.some((track) => track.swing !== null)).toBe(true);
    expect(source).toMatch(/x\?0\.\d/);
    expect(new Set(program.tracks.flatMap((track) => track.effects)).size).toBeGreaterThanOrEqual(3);
    expect(source).toMatch(/\| reverb (small|wide|sea)/);
    expect(source).toMatch(/\| delay (1\/8|3\/16|1\/4)/);
  });

  it("voices the pad, arpeggiates the pluck, glides the legato lead and ducks the bass", () => {
    expect(has("pad").voicing).not.toBeNull();
    expect(has("pluck").arp).not.toBeNull();
    expect(has("lead").legato).toBe(true);
    expect(lineOf(source, has("lead"))).toMatch(/\| glide \d/);
    expect(lineOf(source, has("bass"))).toMatch(/\| duck \d/);
  });

  it("loops the groove: one loop section, and the pluck waits outside it", () => {
    const loops = program.sections.filter((section) => section.isLoop);
    expect(loops.map((section) => section.name)).toEqual(["groove"]);
    expect(loops[0]?.tracks).not.toContain("pluck");
    expect(program.sections).toHaveLength(10);
    expect(program.song?.parts).toHaveLength(11);
  });
});
