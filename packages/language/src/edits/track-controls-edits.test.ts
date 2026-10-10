// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import { renameSection } from "./arrangement-edits";
import { setTrackPattern } from "./pattern-edits";
import { setInstrument } from "./sound-edits";
import { setKey, setTempo } from "./statement-edits";
import type { EditResult } from "./text-changes";
import { addTrack, removeTrackParameters, renameTrack } from "./track-edits";

// The edits of the track controls front:
// each one is minimal, keeps comments and spacing, and the result analyzes.

const registry = registryWith();

function manifest(name: string) {
  const found = registry.get(name);
  if (found === undefined) throw new Error(`no ${name}`);
  return found;
}

const SONG = `// my song
tempo 124 // warm
key c minor
kick:  kick  x... x... x... x...   // the floor
hat:   hat   ..x. ..x. ..x. ..x.   | open 0.7
bass:  bass  c2 . . c2 . . c2 .    | cutoff 900 | drive 0.4 | gain 0.8  // low end
section build  kick hat
section drop   kick hat bass | loop
song build 8, drop 16, build 8, drop 16
`;

function applied(result: EditResult): string {
  if (!result.ok) throw new Error(result.reason);
  const analyzed = analyze(result.source, registry);
  if (!analyzed.ok) throw new Error(analyzed.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
  return result.source;
}

describe("renameTrack", () => {
  it("renames hat to hats in its line and in every section, one edit, comments kept", () => {
    const next = applied(renameTrack(SONG, "hat", "hats"));
    expect(next).toBe(SONG.replace("hat:   hat", "hats:   hat").replace("build  kick hat\n", "build  kick hats\n").replace("drop   kick hat bass", "drop   kick hats bass"));
  });

  it("refuses a taken name, a malformed one and a word of the language", () => {
    expect(renameTrack(SONG, "hat", "kick")).toEqual({ ok: false, reason: "NAME_TAKEN" });
    expect(renameTrack(SONG, "hat", "open hat")).toEqual({ ok: false, reason: "INVALID_NAME" });
    expect(renameTrack(SONG, "hat", "section")).toEqual({ ok: false, reason: "RESERVED_NAME" });
  });
});

describe("renameSection", () => {
  it("renames drop to peak in its section line and every use in the song, one edit", () => {
    const next = applied(renameSection(SONG, "drop", "peak"));
    expect(next).toBe(SONG.replace("section drop ", "section peak ").replace("song build 8, drop 16, build 8, drop 16", "song build 8, peak 16, build 8, peak 16"));
  });

  it("refuses a taken part name and an unknown part; the same name changes nothing", () => {
    expect(renameSection(SONG, "drop", "build")).toEqual({ ok: false, reason: "NAME_TAKEN" });
    expect(renameSection(SONG, "outro", "end")).toEqual({ ok: false, reason: "UNKNOWN_SECTION" });
    expect(renameSection(SONG, "drop", "song")).toEqual({ ok: false, reason: "RESERVED_NAME" });
    expect(applied(renameSection(SONG, "drop", "drop"))).toBe(SONG);
  });

  it("lets a part share a track's name: they are separate spaces", () => {
    expect(applied(renameSection(SONG, "drop", "bass"))).toContain("section bass   kick hat bass | loop");
  });
});

describe("setTempo and setKey", () => {
  it("replace the value and keep the comment", () => {
    expect(applied(setTempo(SONG, 128))).toBe(SONG.replace("tempo 124 // warm", "tempo 128 // warm"));
    expect(applied(setKey(SONG, "d", "dorian"))).toBe(SONG.replace("key c minor", "key d dorian"));
  });

  it("accept 40 to 300 BPM and refuse outside it", () => {
    expect(applied(setTempo(SONG, 40))).toContain("tempo 40 //");
    expect(applied(setTempo(SONG, 300))).toContain("tempo 300 //");
    expect(setTempo(SONG, 39.5)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setTempo(SONG, 301)).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });
});

describe("setInstrument (Change sound)", () => {
  it("swaps bass for acid, keeps the pattern, the mix and the shared parameters, drops the rest", () => {
    const next = applied(setInstrument(SONG, "bass", manifest("acid"), "squelch"));
    // acid has its own drive since the VA core gained one, so drive is shared.
    expect(next).toContain("bass:  acid squelch  c2 . . c2 . . c2 .    | cutoff 900 | drive 0.4 | gain 0.8  // low end");
  });

  it("keeps a rest-heavy bass pattern: rests are no hits", () => {
    const source = "bass: bass . . . c2 . . . . . . . . . . eb2 .\n";
    expect(applied(setInstrument(source, "bass", manifest("pluck"), null))).toBe("bass: pluck . . . c2 . . . . . . . . . . eb2 .\n");
  });

  it("refuses an instrument that cannot play the pattern", () => {
    expect(setInstrument("pad: pad Cm7 ~ ~ ~\n", "pad", manifest("bass"), null)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setInstrument(SONG, "kick", manifest("bass"), null)).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });

  it("names an unnamed track after its old instrument, so sections keep working", () => {
    const next = applied(setInstrument("bass c2 . . c2\nsection a bass\n", "bass", manifest("reese"), null));
    expect(next).toBe("bass: reese c2 . . c2\nsection a bass\n");
  });
});

describe("patterns of the manifest", () => {
  it("adds a bass in a minor with its notes in a (never with transpose)", () => {
    const source = "tempo 124\nkey a minor\nloop 4\n";
    const result = addTrack(source, manifest("bass"), null, null, { tonic: 9, scale: "minor" });
    expect(applied(result)).toBe(`${source.trimEnd()}\nbass: bass a1 . . a1 . . a1 .\n`);
  });

  it("adds chords in the key: Cm7 becomes Am7", () => {
    const result = addTrack("key a minor\n", manifest("pad"), null, null, { tonic: 9, scale: "minor" });
    expect(applied(result)).toBe("key a minor\npad: pad Am7 ~ ~ ~\n");
  });

  it("replaces only a track's pattern, keeping the instrument, the sound and the modifiers", () => {
    const broken = manifest("kick").patterns.find((pattern) => pattern.name === "Broken");
    if (broken === undefined) throw new Error("no Broken");
    const next = applied(setTrackPattern(SONG, "kick", manifest("kick"), broken, null));
    expect(next).toContain(`kick:  kick  ${broken.text}   // the floor`);
    const rolling = manifest("bass").patterns.find((pattern) => pattern.name === "Rolling");
    if (rolling === undefined) throw new Error("no Rolling");
    expect(applied(setTrackPattern(SONG, "bass", manifest("bass"), rolling, { tonic: 2, scale: "dorian" }))).toContain(
      "bass:  bass  . d2 d2 d2 . d2 d2 d2 . d2 d2 d2 . d2 d2 d2    | cutoff 900",
    );
    expect(setTrackPattern(SONG, "lead", manifest("kick"), broken, null)).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
  });
});

describe("removeTrackParameters (Use Tone)", () => {
  it("removes the overriding parameter in one edit and nothing else", () => {
    expect(applied(removeTrackParameters(SONG, "hat", ["open"]))).toBe(SONG.replace("..x.   | open 0.7", "..x."));
    expect(applied(removeTrackParameters(SONG, "kick", ["open"]))).toBe(SONG);
  });
});

describe("a program with zero tracks (the Blank project)", () => {
  it("analyzes without an error, warning only that there is nothing to play", () => {
    const result = analyze("// template: Blank\n// order: 0\ntempo 124\nkey a minor\nloop 4\n// add a track: kick: kick punch x... x... x... x...\n", registry);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map((warning) => [warning.code, warning.message, warning.from, warning.to])).toEqual([
      ["NOTHING_TO_PLAY", "Nothing to play: add a track.", 0, 0],
    ]);
    expect(result.program.tracks).toEqual([]);
    expect(result.program.loopBars).toBe(4);
  });
});
