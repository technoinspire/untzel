// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { bindCatalog, createTranslator } from "@untzel/i18n";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import type { Diagnostic, DiagnosticCode } from "./diagnostics";
import { applyChanges } from "../edits/text-changes";
import { englishMessages } from "../copy/messages";
import ptBrMessages from "../copy/messages.pt-BR";

// The quick fixes: every code with a known fix, the text
// after applying it, whether `fix` may apply it alone, and that nothing else changes.

const registry = registryWith(["kick", "hat", "bass"]);
const library = registryWith();

function diagnosticsOf(source: string, using = registry): readonly Diagnostic[] {
  const result = analyze(source, using);
  return result.ok ? result.warnings : result.diagnostics;
}

/** [code, source, title, source after the fix, safe] */
const CASES: readonly (readonly [DiagnosticCode, string, string, string, boolean])[] = [
  ["UNKNOWN_INSTRUMENT", "k: kik x... // floor", "Change to kick", "k: kick x... // floor", true],
  ["UNKNOWN_MODIFIER", "b: bass c2 | cutof 300", "Change to cutoff", "b: bass c2 | cutoff 300", true],
  ["UNKNOWN_MODIFIER", "kick x...\nsection a kick | gian 0.5", "Change to gain", "kick x...\nsection a kick | gain 0.5", true],
  ["UNKNOWN_SCALE", "key c minr\nkick x...", "Change to minor", "key c minor\nkick x...", true],
  ["UNKNOWN_TRACK", "kick x...\nhat x...\nsection drop kick hta", "Change to hat", "kick x...\nhat x...\nsection drop kick hat", true],
  ["UNKNOWN_SECTION", "kick x...\nsection drop kick\nsong dorp 8", "Change to drop", "kick x...\nsection drop kick\nsong drop 8", true],
  ["OUT_OF_RANGE", "tempo 350\nkick x...", "Change to 300", "tempo 300\nkick x...", true],
  ["OUT_OF_RANGE", "loop 20\nkick x...", "Change to 16", "loop 16\nkick x...", true],
  ["OUT_OF_RANGE", "kick x... | gain 2.5", "Change to 2", "kick x... | gain 2", true],
  ["OUT_OF_RANGE", "kick x... | transpose 30", "Change to 24", "kick x... | transpose 24", true],
  ["OUT_OF_RANGE", "b: bass c2 | cutoff sine(8) 10..2000", "Change to 40", "b: bass c2 | cutoff sine(8) 40..2000", true],
  ["SIGNAL_NEEDS_RANGE", "b: bass c2 | cutoff sine(8)", "Add the range 40..8000", "b: bass c2 | cutoff sine(8) 40..8000", true],
  ["MISSING_VALUE", "kick x... | gain | pan 0.2", "Write gain 0.8", "kick x... | gain 0.8 | pan 0.2", true],
  ["MISSING_VALUE", "b: bass c2 | cutoff", "Write cutoff 600", "b: bass c2 | cutoff 600", true],
  ["DUPLICATE_MODIFIER", "kick x... | gain 0.5 | gain 0.6 // loud", "Remove the earlier gain", "kick x... | gain 0.6 // loud", true],
  ["DUPLICATE_TRACK_NAME", "bass: bass c2\nbass: bass c3", 'Rename to "bass2"', "bass: bass c2\nbass2: bass c3", false],
  ["DUPLICATE_SECTION_NAME", "kick x...\nsection drop kick\nsection drop kick", 'Rename to "drop2"', "kick x...\nsection drop kick\nsection drop2 kick", false],
  // A statement keyword with a typo, on the word itself.
  ["SYNTAX_ERROR", "temp 132\nkick x...", "Change to tempo", "tempo 132\nkick x...", true],
  ["SYNTAX_ERROR", "kick x...\nsectoin drop kick", "Change to section", "kick x...\nsection drop kick", true],
  ["SYNTAX_ERROR", 'titel "Night"\nkick x...', "Change to title", 'title "Night"\nkick x...', true],
  ["SYNTAX_ERROR", "kee c minor\nkick x...", "Change to key", "key c minor\nkick x...", true],
  // Two statements within reach (swing and song): the fix waits for the person.
  ["SYNTAX_ERROR", "swng 0.1\nkick x...", "Change to swing", "swing 0.1\nkick x...", false],
  // A signal shape with a typo.
  ["SYNTAX_ERROR", "b: bass c2 | cutoff sin(8) 40..800", "Change to sine", "b: bass c2 | cutoff sine(8) 40..800", true],
  // A note spelled in capitals or apart, an octave out of MIDI, German H.
  ["INVALID_NOTE", "b: bass C2", "Change to c2", "b: bass c2", true],
  ["INVALID_NOTE", "b: bass c 2 . g1", "Change to c2", "b: bass c2 . g1", true],
  ["INVALID_NOTE", "b: bass c2 b9", "Change to b8", "b: bass c2 b8", true],
  ["INVALID_NOTE", "b: bass h2", "Change to b2", "b: bass b2", false],
  // A sound with a typo.
  ["UNKNOWN_PRESET", "k: kick boon x...", "Change to boom", "k: kick boom x...", true],
  // The limits of a pattern, the nearest delay, a keyword alone, an empty track.
  ["OUT_OF_RANGE", "kick x*17", "Change to 16", "kick x*16", true],
  ["OUT_OF_RANGE", "kick x*0", "Change to 1", "kick x*1", true],
  ["OUT_OF_RANGE", "kick x?1.5", "Change to 1", "kick x?1", true],
  ["OUT_OF_RANGE", "kick x... | delay 1/3", "Change to 1/4", "kick x... | delay 1/4", true],
  ["OUT_OF_RANGE", "kick x... | delay 1/16", "Change to 1/8", "kick x... | delay 1/8", true],
  ["MISSING_VALUE", "tempo\nkick x...", "Write tempo 132", "tempo 132\nkick x...", true],
  ["MISSING_VALUE", "key\nkick x...", "Write key c minor", "key c minor\nkick x...", true],
  ["EMPTY_PATTERN", "kick | gain 0.5", "Write x... x... x... x...", "kick x... x... x... x... | gain 0.5", true],
  ["EMPTY_PATTERN", "kick boom", "Write x... x... x... x...", "kick boom x... x... x... x...", true],
  // A track renamed on its line, still listed under the old name in two sections.
  ["UNKNOWN_TRACK", "kik: kick x...\nhat x...\nsection a kick\nsection b kick hat", "Change every kick to kik", "kik: kick x...\nhat x...\nsection a kik\nsection b kik hat", true],
  ["UNKNOWN_SECTION", "kick x...\nsection drop kick\nsong dorp 8, dorp 4", "Change every dorp to drop", "kick x...\nsection drop kick\nsong drop 8, drop 4", true],
];

/** [code, source, title, source after the fix, safe], against the whole library. */
const LIBRARY_CASES: readonly (readonly [DiagnosticCode, string, string, string, boolean])[] = [
  // A choice, on its name, with the closest one or the first of the list.
  ["UNKNOWN_CHOICE", "l: lead c4 | wave sqare", "Change to square", "l: lead c4 | wave square", true],
  ["UNKNOWN_CHOICE", "l: lead c4 | wave noise", "Change to saw", "l: lead c4 | wave saw", false],
  ["MISSING_VALUE", "l: lead c4 | wave", "Write wave saw", "l: lead c4 | wave saw", true],
  ["OUT_OF_RANGE", "kick x... | reverb hal", "Change to hall", "kick x... | reverb hall", true],
  ["OUT_OF_RANGE", "kick x... | reverb ocean", "Change to wide", "kick x... | reverb wide", false],
];

describe("quick fixes attached to diagnostics", () => {
  it.each(CASES)("%s: %s", (code, source, title, fixed, safe) => {
    const diagnostic = diagnosticsOf(source).find((candidate) => candidate.code === code);
    expect(diagnostic?.fix?.title).toBe(title);
    expect(diagnostic?.fix?.safe).toBe(safe);
    const after = applyChanges(source, diagnostic?.fix?.changes ?? []).source;
    expect(after).toBe(fixed);
    // The fixed text no longer reports that code (DUPLICATE_MODIFIER was only a warning).
    expect(diagnosticsOf(after).map((candidate) => candidate.code)).not.toContain(code);
  });

  it.each(LIBRARY_CASES)("%s: %s", (code, source, title, fixed, safe) => {
    const diagnostic = diagnosticsOf(source, library).find((candidate) => candidate.code === code);
    expect(diagnostic?.fix?.title).toBe(title);
    expect(diagnostic?.fix?.safe).toBe(safe);
    const after = applyChanges(source, diagnostic?.fix?.changes ?? []).source;
    expect(after).toBe(fixed);
    expect(diagnosticsOf(after, library).map((candidate) => candidate.code)).not.toContain(code);
  });

  it("gives every copy of a renamed track the same single fix, and fix applies it once", () => {
    const source = "kik: kick x...\nhat x...\nsection a kick\nsection b kick hat";
    const found = diagnosticsOf(source).filter((diagnostic) => diagnostic.code === "UNKNOWN_TRACK");
    expect(found).toHaveLength(2);
    expect(found[0]?.fix).toEqual(found[1]?.fix);
    expect(found[0]?.fix?.changes).toHaveLength(2);
  });

  it("marks a fix between two different concepts as not safe, and offers none past the reach", () => {
    // pan is two edits from gain: not suggested for a section.
    expect(diagnosticsOf("kick x...\nsection a kick | pan 0.5")[0]?.fix).toBeUndefined();
    // b -> a: a one-character name gets no suggestion.
    expect(diagnosticsOf("kick x...\nsection a kick\nsong b 8")[0]?.fix).toBeUndefined();
  });

  it("offers nothing when no suggestion is close enough", () => {
    const [diagnostic] = diagnosticsOf("k: zzzzzz x...");
    expect(diagnostic?.code).toBe("UNKNOWN_INSTRUMENT");
    expect(diagnostic?.fix).toBeUndefined();
  });

  it("has no fix for a generic syntax error, a kind mismatch or a signal on a fixed value", () => {
    for (const source of ["kick: kick x ]", "kick x... c2", "kick x... | swing sine(4) 0..0.5", "b: bass c2 | cutoff wobble(8) 40..800"]) {
      expect(diagnosticsOf(source).every((diagnostic) => diagnostic.fix === undefined)).toBe(true);
    }
  });

  it("says Did you mean for an unknown track or section", () => {
    const messages = diagnosticsOf("kick x...\nsection drop kik\nsong dorp 8").map((diagnostic) => diagnostic.message);
    expect(messages).toEqual([
      'Section "drop" uses "kik", but no track has that name. Did you mean "kick"?',
      'The song uses "dorp", but no section has that name. Did you mean "drop"?',
    ]);
  });

  it("titles a fix with a catalog key, so the button translates like the message", () => {
    const [diagnostic] = diagnosticsOf("kick x...\nsection drop kik");
    expect(diagnostic?.fix).toMatchObject({ title: "Change to kick", titleKey: "fixChange", titleArgs: ["kick"] });
    const portuguese = bindCatalog(createTranslator("pt-BR"), englishMessages, [ptBrMessages]);
    expect(portuguese.fixChange("kick")).toBe("Trocar por kick");
    expect(portuguese.unknownTrack("drop", "kik", "kick")).toBe(
      'A seção "drop" usa "kik", mas nenhuma faixa tem esse nome. Você quis dizer "kick"?',
    );
  });
});
