// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { lineDiff } from "./proposal/diff";
import { composerOf, ONBOARD } from "./testing/composer";

// Completion of the command line and of the code, the usage hint and the hover help, all from the registry.

const composer = composerOf(registryWith(["kick", "hat", "bass"]));

function labels(line: string, cursor = line.length): string[] {
  return composer.completeLine(line, cursor, ONBOARD).options.map((option) => option.label);
}

function code(source: string): string[] {
  return composer.completeCode(source, source.length)?.options.map((option) => option.label) ?? [];
}

describe("command line completion", () => {
  it("completes commands, with the ghost of the first match", () => {
    expect(labels("te")).toEqual(["tempo"]);
    const typing = composer.completeLine("add b", 5, ONBOARD);
    expect(typing.options.map((option) => option.label)).toEqual(["bass"]);
    expect(typing.ghost).toBe("ass");
    expect(typing.hint).toBe("add <instrument> [name] · a new track");
    expect(typing.from).toBe(4);
  });

  it("instruments come from the registry, tracks and sections from the text", () => {
    expect(labels("add ")).toEqual(["bass", "hat", "kick"]);
    expect(labels("mute ")).toEqual(["kick", "hat", "ride", "sub", "bass"]);
    expect(labels("song intro 8, d")).toEqual(["drop"]);
    expect(labels("section drop kick ")).toEqual(["hat", "ride", "sub", "bass"]);
    expect(labels("key c ")).toEqual(["minor", "major", "dorian", "phrygian", "chromatic"]);
  });

  it("parameters of the track's instrument, then their values", () => {
    // The instrument's own parameters first, then the insert effects every track has.
    expect(labels("set bass c")).toEqual(["cutoff", "crush", "chorus", "chorus-rate", "comp"]);
    expect(composer.completeLine("set bass c", 10, ONBOARD).hint).toBe(
      "set <track> <param> <value> · cutoff 40 to 8000 Hz, default 600",
    );
    expect(labels("set bass cutoff ")).toEqual(["600", "sine(8) 40..8000"]);
    expect(labels("set kick reverb ")).toEqual(["small", "wide", "sea", "room", "plate", "hall", "dub"]);
  });

  it("the tempo hint gives the range", () => {
    expect(composer.completeLine("tempo ", 6, ONBOARD).hint).toBe("tempo <bpm> · 40 to 300");
  });
});

describe("code completion", () => {
  it("line start: instruments and statements", () => {
    expect(code("")).toEqual(["bass", "hat", "kick", "title", "tempo", "key", "swing", "loop", "section", "song"]);
    expect(code("b")).toEqual(["bass"]);
    expect(code("acid: ")).toEqual(["bass", "hat", "kick"]);
  });

  it("title: suggested at the line start, nothing inside its name", () => {
    const start = composer.completeCode("ti", 2);
    expect(start?.options).toEqual([{ label: "title", detail: 'title "<name>", the song\'s name, up to 60 characters' }]);
    expect(start?.explicitOnly).toBe(false);
    expect(composer.completeCode('title "', 7)).toBeNull();
    expect(composer.completeCode('title "b', 8)).toBeNull();
    expect(composer.completeCode('title "Midnight Coast" ', 23)).toBeNull();
    // "title:" stays a track name, completed as one.
    expect(code("title: ")).toEqual(["bass", "hat", "kick"]);
  });

  it("a parameter is written with a value the analysis accepts", () => {
    const source = "ride: hat x.x. | o";
    const open = composer.completeCode(source, source.length)?.options.find((option) => option.label === "open");
    expect(open).toMatchObject({ label: "open", insert: "open 0" });
  });

  it("modifiers and values after |", () => {
    expect(code("bass c2 | cut")).toEqual(["cutoff"]);
    expect(code("bass c2 | cutoff ")).toEqual(["600", "sine(8) 40..8000", "tri(8) 40..8000", "saw(8) 40..8000", "square(8) 40..8000", "rand(8) 40..8000"]);
    expect(code("kick x... | reverb ")).toEqual(["small", "wide", "sea", "room", "plate", "hall", "dub"]);
  });

  it("notes of the key for pitched tracks, hits for drums", () => {
    expect(code("key a minor\nbass ").slice(0, 7)).toEqual(["a1", "b1", "c2", "d2", "e2", "f2", "g2"]);
    expect(code("kick ")).toContain("x...");
    // Steps open only on Ctrl+Space; names and modifiers open while typing.
    expect(composer.completeCode("kick ", 5)?.explicitOnly).toBe(true);
    expect(composer.completeCode("bass c2 | cut", 13)?.explicitOnly).toBe(false);
  });

  it("key, section and song", () => {
    expect(code("key c d")).toEqual(["dorian"]);
    expect(code(`${ONBOARD}section outro k`)).toEqual(["kick"]);
    expect(code(`${ONBOARD}song intro 8, b`)).toEqual(["build", "break"]);
  });

  it("nothing in a comment", () => {
    expect(composer.completeCode("kick x... // b", 14)).toBeNull();
  });
});

describe("hover help", () => {
  it("a parameter: its instrument, range, default and unit", () => {
    const source = "bass c2 | cutoff 900";
    expect(composer.hover(source, source.indexOf("cutoff") + 2)).toEqual({
      from: 10,
      to: 16,
      lines: ["cutoff · bass parameter", "40 to 8000 Hz, default 600 · exponential"],
    });
  });

  it("an instrument and a signal", () => {
    const source = "b: bass c2 | cutoff sine(8) 40..900";
    // The manifest's description and the group and kind in words, not "bass, pitched".
    expect(composer.hover(source, 4)?.lines).toEqual([
      "bass · instrument",
      "Saw bass with a plucked filter",
      "Bass · plays notes",
      "parameters: cutoff, decay, drive",
    ]);
    expect(composer.hover(source, source.indexOf("sine") + 1)?.lines[0]).toBe("sine(<bars>) · signal");
  });

  it("a named sound, with the manifest's description", () => {
    const source = "kick tight x... | decay 0.2";
    expect(composer.hover(source, source.indexOf("tight") + 1)?.lines).toEqual([
      "tight · kick sound",
      "Short and tight: a fast small sweep, a loud click and grit",
    ]);
    expect(composer.hover("hat x...", 1)?.lines.slice(1, 3)).toEqual(["Hi-hat, closed to open", "Drums · plays hits"]);
  });

  it("the descriptions in the page's language, through the composition root's describer", () => {
    const translated = composerOf(registryWith(["kick", "hat", "bass"]), {
      instrument: (instrument, english) => (instrument === "bass" ? "Bass de serra com filtro pinçado" : english),
      sound: (instrument, sound, english) => (`${instrument}/${sound}` === "kick/tight" ? "Curto e seco" : english),
    });
    expect(translated.hover("bass c2", 1)?.lines[1]).toBe("Bass de serra com filtro pinçado");
    expect(translated.hover("kick tight x...", 6)?.lines).toEqual(["tight · kick sound", "Curto e seco"]);
    // Without a translation, the manifest's English.
    expect(translated.hover("hat x...", 1)?.lines[1]).toBe("Hi-hat, closed to open");
  });

  it("the title statement, and never a word inside the song's name", () => {
    const source = 'title "bass night"';
    expect(composer.hover(source, 2)?.lines).toEqual(["title · statement", 'title "<name>", the song\'s name, up to 60 characters']);
    expect(composer.hover(source, source.indexOf("bass") + 1)).toBeNull();
  });
});

describe("line diff", () => {
  it("pairs a replaced line with its new version", () => {
    expect(lineDiff("a\nb\nc", "a\nB\nc")).toEqual([
      { kind: "removed", line: 2, text: "b" },
      { kind: "added", line: 2, text: "B" },
    ]);
    expect(lineDiff("a", "a\nb")).toEqual([{ kind: "added", line: 2, text: "b" }]);
  });
});
