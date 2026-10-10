// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentRegistry } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import { DIAGNOSTIC_CODES, type Diagnostic, type DiagnosticCode } from "./diagnostics";

const registry = registryWith();

function diagnosticsOf(source: string, using: InstrumentRegistry = registry): readonly Diagnostic[] {
  const result = analyze(source, using);
  return result.ok ? result.warnings : result.diagnostics;
}

const WARNING_CODES: ReadonlySet<DiagnosticCode> = new Set(["DUPLICATE_MODIFIER", "NO_EFFECT", "EMPTY_TITLE", "TITLE_TOO_LONG", "NOTHING_TO_PLAY"]);
/** [code, source, text the diagnostic points at, message] */
const CASES: readonly (readonly [DiagnosticCode, string, string, string])[] = [
  ["UNKNOWN_INSTRUMENT", "k: kik x...", "kik", 'Unknown instrument "kik". Did you mean "kick"?'],
  ["DUPLICATE_TRACK_NAME", "bass: bass c2\nbass: bass c3", "bass", 'A track named "bass" already exists on line 1.'],
  ["UNKNOWN_TRACK", "kick x...\nsection drop kick acid2", "acid2", 'Section "drop" uses "acid2", but no track has that name.'],
  ["UNKNOWN_SECTION", "kick x...\nsection drop kick\nsong chorus 8", "chorus", 'The song uses "chorus", but no section has that name.'],
  ["DUPLICATE_SECTION_NAME", "kick x...\nsection drop kick\nsection drop kick", "drop", 'A section named "drop" already exists on line 2.'],
  ["UNKNOWN_MODIFIER", "b: bass c2 | cutof 300", "cutof", '"bass" has no parameter "cutof". Did you mean "cutoff"?'],
  ["OUT_OF_RANGE", "tempo 320\nkick x...", "320", "tempo must be between 40 and 300."],
  ["EMPTY_PATTERN", "kick | gain 0.5", "kick", "This track has no steps."],
  ["INVALID_NOTE", "b: bass h2", "h2", '"h2" is not a note. Did you mean "b2"?'],
  ["SIGNAL_NEEDS_RANGE", "b: bass c2 | cutoff sine(8)", "sine(8)", "sine(8) needs a range, for example 40..8000."],
  ["SYNTAX_ERROR", "kick: kick x ]", "]", 'Unexpected "]".'],
  ["UNKNOWN_SCALE", "key c minr\nkick x...", "minr", 'Unknown scale "minr". Did you mean "minor"?'],
  ["NAME_TOO_LONG", "abcdefghijklmnopqrstuvwxy: kick x...", "abcdefghijklmnopqrstuvwxy", "A name can have at most 24 characters."],
  ["TOO_MANY_STEPS", `kick ${"x".repeat(65)}`, "x".repeat(65), "A bar can have at most 64 steps."],
  ["TOO_MANY_BARS", `kick ${Array.from({ length: 65 }, () => "x").join(" / ")}`, Array.from({ length: 65 }, () => "x").join(" / "), "A pattern can have at most 64 bars."],
  ["PATTERN_KIND_MISMATCH", "kick x... c2", "c2", '"kick" plays hits, not notes.'],
  ["MISSING_VALUE", "tempo\nkick x...", "tempo", "tempo needs a value, for example tempo 132."],
  ["DUPLICATE_SONG", "kick x...\nsection a kick\nsong a 8\nsong a 4", "song", "A text can have only one song."],
  ["OUT_OF_ORDER", "kick x...\nsection a kick\nhat x...", "hat", "Sections come after tracks."],
  ["DUPLICATE_STATEMENT", "tempo 120\ntempo 130\nkick x...", "tempo", "tempo is already set on line 1."],
  ["DUPLICATE_MODIFIER", "kick x... | gain 0.5 | gain 0.6", "gain 0.5", "gain is set twice; the last one wins."],
  ["UNKNOWN_PRESET", "k: kick boon x...", "boon", '"kick" has no sound "boon". Did you mean "boom"?'],
  ["UNKNOWN_CHOICE", "l: lead c4 | wave noise", "noise", '"wave" can be saw, square, triangle or sine.'],
  ["SIGNAL_NEEDS_NUMBER", "l: lead c4 | wave sine(4) 0..1", "sine(4) 0..1", '"wave" takes a name, not a signal.'],
  ["NO_EFFECT", "b: bass c2 | legato", "legato", 'legato needs a one-voice instrument; "bass" plays several voices.'],
  ["TOO_MANY_MODULATORS", "l: lead c4 | cutoff sine(1/8) 300..900 | detune sine(1/4) 0..1 | attack tri(1/2) 0.01..0.1 | release saw(1/2) 0.1..1 | gain sine(1/8) 0.2..0.8 | pan sine(1/4) -0.5..0.5 | lowpass sine(1/8) 500..5000 | highpass sine(1/8) 50..500 | distort sine(1/8) 0..0.5", "distort sine(1/8) 0..0.5", "A track can have at most 8 fast signals."],
  ["DUPLICATE_LOOP_SECTION", "kick x...\nsection a kick | loop\nsection b kick | loop", "loop", 'Only one section can be the loop; "a" already is on line 2.'],
  ["EMPTY_TITLE", 'title "  "\nkick x...', '"  "', "The song title is empty; the last title stays."],
  ["TITLE_TOO_LONG", `title "${"a".repeat(61)}"\nkick x...`, `"${"a".repeat(61)}"`, "A song title can have at most 60 characters."],
  ["SIGNAL_NOT_ALLOWED", "kick x... | swing rand(4) 0..0.5", "rand(4)", "swing takes a number, not a signal."],
  ["NOTHING_TO_PLAY", "// nothing yet", "", "Nothing to play: add a track."],
];

describe("every diagnostic code", () => {
  it.each(CASES)("%s", (code, source, text, message) => {
    const found = diagnosticsOf(source);
    expect(found.map((diagnostic) => diagnostic.code)).toEqual([code]);
    const [diagnostic] = found as [Diagnostic];
    expect(source.slice(diagnostic.from, diagnostic.to)).toBe(text);
    expect(diagnostic.message).toBe(message);
    expect(diagnostic.severity).toBe(WARNING_CODES.has(code) ? "warning" : "error");
  });

  it("SOURCE_TOO_LONG, without analyzing", () => {
    const result = analyze(`kick ${"x".repeat(65_536)}`, registry);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toEqual([
      { code: "SOURCE_TOO_LONG", message: "A song can have at most 65,536 characters.", messageKey: "sourceTooLong", messageArgs: [65_536], from: 65_536, to: 65_541, severity: "error" },
    ]);
  });

  it("INTERNAL_ERROR when the registry throws, keeping the exception", () => {
    const failure = new Error("broken registry");
    const throwing = new Map(registry);
    throwing.get = () => {
      throw failure;
    };
    const result = analyze("kick x...", throwing);
    expect(result).toEqual({
      ok: false,
      diagnostics: [{ code: "INTERNAL_ERROR", message: "Something went wrong while reading this text.", messageKey: "internalError", messageArgs: [], from: 0, to: 0, severity: "error" }],
      internalError: failure,
    });
  });

  it("covers every code of the contract", () => {
    const covered = new Set<string>([...CASES.map(([code]) => code), "SOURCE_TOO_LONG", "INTERNAL_ERROR"]);
    expect([...DIAGNOSTIC_CODES].filter((code) => !covered.has(code))).toEqual([]);
  });
});

/** [code, source, the word the diagnostic must cover (from..to), message] */
const SPANS: readonly (readonly [DiagnosticCode, string, string, string])[] = [
  ["SYNTAX_ERROR", "temp 132\nkick x...", "temp", 'Unknown statement "temp". Did you mean "tempo"?'],
  ["SYNTAX_ERROR", "kick x...\nsectoin drop kick", "sectoin", 'Unknown statement "sectoin". Did you mean "section"?'],
  ["SYNTAX_ERROR", "kick x...\nsection drop kick\nsogn drop 8", "sogn", 'Unknown statement "sogn". Did you mean "song"?'],
  ["SYNTAX_ERROR", 'titel "Night"\nkick x...', "titel", 'Unknown statement "titel". Did you mean "title"?'],
  ["SYNTAX_ERROR", "kee c minor\nkick x...", "kee", 'Unknown statement "kee". Did you mean "key"?'],
  ["SYNTAX_ERROR", "swng 0.1\nkick x...", "swng", 'Unknown statement "swng". Did you mean "swing"?'],
  ["SYNTAX_ERROR", "b: bass c2 | cutoff sin(8) 40..800", "sin", 'Unknown signal "sin". Did you mean "sine"?'],
  ["SYNTAX_ERROR", "b: bass c2 | cutoff sqare(8) 40..800", "sqare", 'Unknown signal "sqare". Did you mean "square"?'],
  ["SYNTAX_ERROR", "b: bass c2 | cutoff wobble(8) 40..800", "wobble", 'Unknown signal "wobble".'],
  ["SYNTAX_ERROR", "piano xylo c3", "xylo", 'Unexpected "xylo".'],
  ["SYNTAX_ERROR", "kick: kick x... ]", "]", 'Unexpected "]".'],
  ["INVALID_NOTE", "b: bass C2", "C2", '"C2" is not a note. Did you mean "c2"?'],
  ["INVALID_NOTE", "b: bass c 2", "c 2", '"c 2" is not a note. Did you mean "c2"?'],
  ["INVALID_NOTE", "b: bass c2 . Eb2", "Eb2", '"Eb2" is not a note. Did you mean "eb2"?'],
  ["INVALID_NOTE", "b: bass c2 b9", "b9", '"b9" is not a note.'],
  ["UNKNOWN_CHOICE", "l: lead c4 | wave sqare", "sqare", '"wave" can be saw, square, triangle or sine. Did you mean "square"?'],
  ["OUT_OF_RANGE", "kick x... | reverb hal", "hal", 'reverb must be small, wide, sea, room, plate, hall, dub or a number between 0 and 1. Did you mean "hall"?'],
  ["OUT_OF_RANGE", "kick x... | delay 1/3", "1/3", "delay must be 1/8, 3/16 or 1/4."],
  ["OUT_OF_RANGE", "kick x*17", "17", "A repeat must be a whole number from 1 to 16."],
  ["OUT_OF_RANGE", "kick x?1.5", "1.5", "A probability must be between 0 and 1."],
  ["UNKNOWN_PRESET", "k: kick boon x...", "boon", '"kick" has no sound "boon". Did you mean "boom"?'],
  ["UNKNOWN_INSTRUMENT", "k: kik x...", "kik", 'Unknown instrument "kik". Did you mean "kick"?'],
  ["UNKNOWN_MODIFIER", "kick x...\nsection a kick | gian 0.5", "gian", 'A section only takes tempo, gain and loop, not "gian". Did you mean "gain"?'],
  ["UNKNOWN_SCALE", "key c minr\nkick x...", "minr", 'Unknown scale "minr". Did you mean "minor"?'],
  ["UNKNOWN_SECTION", "kick x...\nsection drop kick\nsong dorp 8", "dorp", 'The song uses "dorp", but no section has that name. Did you mean "drop"?'],
  ["MISSING_VALUE", "l: lead c4 | wave", "wave", "wave needs a value, for example wave saw."],
  ["EMPTY_PATTERN", "kick boom | gain 0.5", "kick", "This track has no steps."],
];

describe("exact spans: each diagnostic covers the word that caused it", () => {
  it.each(SPANS)("%s: %j", (code, source, text, message) => {
    const found = diagnosticsOf(source);
    expect(found.map((diagnostic) => diagnostic.code)).toEqual([code]);
    const [diagnostic] = found as [Diagnostic];
    expect({ text: source.slice(diagnostic.from, diagnostic.to), from: diagnostic.from, to: diagnostic.to }).toEqual({
      text,
      from: source.indexOf(text),
      to: source.indexOf(text) + text.length,
    });
    expect(diagnostic.message).toBe(message);
  });

  it("does not take a typo of a statement for an instrument, nor a named track for a statement", () => {
    expect(diagnosticsOf("kick x... 132").map((diagnostic) => diagnostic.message)).toEqual(['Unexpected "132".']);
    expect(diagnosticsOf("temp: kick x... 132").map((diagnostic) => diagnostic.message)).toEqual(['Unexpected "132".']);
  });

  it("does not take a track line with a pattern for a misspelled statement", () => {
    // "keys" and "sing" are near "key" and "song", but the steps make them instruments.
    for (const source of ["keys x... ]", "sing x... ]", "sing tight x... ]", "keys c2 . eb2 ]", "keys [x .] ]", "keys Cm ]"]) {
      expect(diagnosticsOf(source).map((diagnostic) => diagnostic.message), source).toEqual(['Unexpected "]".']);
    }
    // The steps are read before the first "|" and outside the song's name.
    expect(diagnosticsOf('titel "x... night"\nkick x...')[0]?.message).toBe('Unknown statement "titel". Did you mean "title"?');
    expect(diagnosticsOf("kick x...\nsectoin drop kick | gain 0.5 // x...")[0]?.message).toBe('Unknown statement "sectoin". Did you mean "section"?');
  });

  it("suggests nothing for a one-character name and nothing farther than a third of the word", () => {
    expect(diagnosticsOf("kick x...\nsection a kick\nsong b 8").map((diagnostic) => diagnostic.message)).toEqual([
      'The song uses "b", but no section has that name.',
    ]);
    expect(diagnosticsOf("kick x...\nsection a kick | pan 0.5")[0]?.fix).toBeUndefined();
  });
});

describe("diagnostic rules", () => {
  it("reports EMPTY_PATTERN for a bare instrument", () => {
    expect(diagnosticsOf("kick").map((diagnostic) => diagnostic.code)).toEqual(["EMPTY_PATTERN"]);
  });

  it("reports MISSING_VALUE for a modifier without value and for every keyword alone", () => {
    expect(diagnosticsOf("kick x... | gain").map((diagnostic) => diagnostic.code)).toEqual(["MISSING_VALUE"]);
    for (const keyword of ["key", "swing", "section", "song"]) {
      expect(diagnosticsOf(`${keyword}\nkick x...`).map((diagnostic) => diagnostic.code)).toEqual(["MISSING_VALUE"]);
    }
  });

  it("gives one diagnostic per physical line with a syntax error", () => {
    const found = diagnosticsOf("kick: kick x ] ]\nhat: hat x ] @\nbass c2");
    expect(found.map((diagnostic) => diagnostic.code)).toEqual(["SYNTAX_ERROR", "SYNTAX_ERROR"]);
  });

  it("still declares the track name of a line with a syntax error", () => {
    const found = diagnosticsOf("b: bass h2\nsection a b");
    expect(found.map((diagnostic) => diagnostic.code)).toEqual(["INVALID_NOTE"]);
  });

  it("checks only general modifiers of an unknown instrument and keeps its name", () => {
    const found = diagnosticsOf("gong: gong x... | spread 0.5 | gain 3\nsection a gong");
    expect(found.map((diagnostic) => diagnostic.code)).toEqual(["UNKNOWN_INSTRUMENT", "OUT_OF_RANGE"]);
  });

  it("collects every error, not only the first", () => {
    const found = diagnosticsOf("tempo 20\nkey c minr\nk: kik x...\nb: bass c2 | cutof 1");
    expect(found.map((diagnostic) => diagnostic.code)).toEqual(["OUT_OF_RANGE", "UNKNOWN_SCALE", "UNKNOWN_INSTRUMENT", "UNKNOWN_MODIFIER"]);
  });

  it.each([
    ["kick x...?1.5", "1.5"],
    ["kick x*17", "17"],
    ["kick x*0", "0"],
    ["kick [[[[[x]]]]]", "[x]"],
    ["kick x... | pan 2", "2"],
    ["kick x... | transpose 1.5", "1.5"],
    ["kick x... | swing 0.6", "0.6"],
    ["kick x... | shift 1025", "1025"],
    ["kick x... | reverb cave", "cave"],
    ["kick x... | reverb 1.5", "1.5"],
    ["kick x... | delay 1/16", "1/16"],
    ["kick x... | gain sine(0) 0..1", "0"],
    ["kick x... | gain sine(300) 0..1", "300"],
    ["kick x... | gain sine(4) 0..3", "3"],
    ["kick x... | gain 2.5", "2.5"],
    ["kick x... | mute 1", "1"],
    ["b: bass c2 | cutoff 9000", "9000"],
    ["b: bass c2 | cutoff saw(4) 10..900", "10"],
    ["kick x...\nsection a kick | gain 2", "2"],
    ["kick x...\nsection a kick\nsong a 0", "0"],
    ["kick x...\nsection a kick\nsong a 300", "300"],
    ["b: bass a9", "a9"],
  ])("rejects %j", (source, text) => {
    const found = diagnosticsOf(source);
    expect(found).toHaveLength(1);
    const [diagnostic] = found as [Diagnostic];
    expect(["OUT_OF_RANGE", "INVALID_NOTE"]).toContain(diagnostic.code);
    expect(source.slice(diagnostic.from, diagnostic.to)).toBe(text);
  });

  it("rejects modifiers a section does not take", () => {
    const found = diagnosticsOf("kick x...\nsection a kick | pan 0.5");
    expect(found.map((diagnostic) => [diagnostic.code, diagnostic.message])).toEqual([
      ["UNKNOWN_MODIFIER", 'A section only takes tempo, gain and loop, not "pan".'],
    ]);
  });

  it.each([
    ["kick x... | transpose sine(4) 0..1", "sine(4)"],
    ["kick x... | swing rand(4) 0..0.5", "rand(4)"],
    ["kick x... | shift saw(4) 0..2", "saw(4)"],
    ["kick x... | velocity tri(2) 0..1", "tri(2)"],
    ["kick x...\nsection a kick | gain sine(4) 0..1", "sine(4)"],
    ["kick x...\nsection a kick | tempo sine(4) 100..120", "sine(4)"],
  ])("SIGNAL_NOT_ALLOWED for a fixed value: %j", (source, text) => {
    const found = diagnosticsOf(source);
    expect(found.map((diagnostic) => diagnostic.code)).toEqual(["SIGNAL_NOT_ALLOWED"]);
    expect(source.slice(found[0]?.from, found[0]?.to)).toBe(text);
  });

  it("warns NOTHING_TO_PLAY for an empty text and keeps it valid", () => {
    const result = analyze("", registry);
    expect(result.ok && result.warnings.map((warning) => [warning.code, warning.from, warning.to])).toEqual([["NOTHING_TO_PLAY", 0, 0]]);
    expect(diagnosticsOf("kick x...")).toEqual([]);
  });

  it("reports globals after tracks and the song before sections", () => {
    expect(diagnosticsOf("kick x...\ntempo 120").map((diagnostic) => diagnostic.message)).toEqual([
      "tempo comes before tracks, sections and the song.",
    ]);
    expect(diagnosticsOf("kick x...\nsection a kick\nsong a 8\nsection b kick").map((diagnostic) => diagnostic.message)).toEqual([
      "The song comes after tracks and sections.",
    ]);
  });
});
