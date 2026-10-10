// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { parser } from "./read/parser";

// One positive and one negative case per production of the grammar.

function hasSyntaxError(source: string): boolean {
  let found = false;
  parser.parse(source).iterate({
    enter: (node) => {
      if (node.type.isError) found = true;
    },
  });
  return found;
}

const PRODUCTIONS: readonly (readonly [production: string, valid: string, invalid: string])[] = [
  ["source / line", "tempo 132\n\nkick x...\n", "tempo 132 kick x..."],
  ["comment", "kick x... // four on the floor", "kick x... / / not a comment"],
  ["statement title", 'title "Midnight Coast"', 'title "Midnight Coast'],
  ["string escapes", 'title "say \\"hi\\" \\\\ ok"', 'title "a\\nb"'],
  ["title as a track name", "title: kick x...", 'title: "x"'],
  ["statement tempo", "tempo 132.5", "tempo 132 fast"],
  ["statement key", "key eb minor", "key h minor"],
  ["statement swing", "swing 0.12", "swing 0.1 loose"],
  ["track", "kick: kick x...", "kick: : kick x..."],
  ["track short form", "kick x... | gain 0.5", "| gain 0.5"],
  ["section", "section drop kick hat | gain 0.8", "section Drop kick"],
  ["song", "song intro 8, drop 16 | loop", "song intro, drop 16"],
  ["part", "song drop 16", "song 16 drop"],
  ["pattern", "kick x... / x.x.", "kick x... /"],
  ["bar", "kick x x x x", "kick x... / / x..."],
  ["element probability", "kick x?0.3", "kick x??"],
  ["element repeat", "kick x*4", "kick x**4"],
  ["atom group", "kick [x [x x]]", "kick [x x"],
  ["atom sustain", "pad Cm7 ~ ~ ~", "pad Cm7 ~*"],
  ["hits", "kick X.x~", "kick x.y"],
  ["note", "bass c2 eb2 f#1", "bass c c2"],
  ["chord", "pad Cm7 Abmaj7 Gsus4 Bbdim Cmaj9 Am7b5 G7sus4 Fadd9 Dm11 C13 Eaug Bdim7", "pad Cmaj13"],
  ["chord quality", "pad C6 Cm6 C9 Cm9 Cmadd9 C11", "pad Cm7#5"],
  ["preset", "lead: square hollow c3", "piano bright grand c3"],
  ["preset not a hit", "piano zebra-2 c3", "piano xylo c3"],
  ["preset not a tonic", "square: square c3", "piano eb c3"],
  ["preset not a single letter", "piano felt c3", "piano a c3"],
  ["accent", "hat ..x! x.x.!", "kick x!!"],
  ["accent on a group", "pad [c3 e3]!", "pad [c3 e3]!!"],
  ["stack", "pad c3+eb3+g3 ~ ~ .", "pad c3+"],
  ["stack of notes only", "pad c3+e3+g3!", "pad c3+Cm"],
  ["signal division", "lead c3 | cutoff square(1/8) 300..900", "lead c3 | cutoff sine(1/) 300..900"],
  ["envelope", "lead c3 | cutoff env(0.3) 300..4000", "lead c3 | cutoff env() 300..4000"],
  ["choice", "lead c3 | wave square", "lead c3 | wave square saw"],
  ["loop section", "section groove kick hat | loop", "section groove kick | | loop"],
  ["modifier", "kick x | mute", "kick x | | mute"],
  ["value number", "kick x | gain -0.5", "kick x | gain 0..5"],
  ["value signal with range", "acid c2 | cutoff sine(8) 300..2400", "acid c2 | cutoff sine 300..2400"],
  ["value division", "kick x | delay 3/16", "kick x | delay 3/"],
  ["value identifier", "pad Cm7 | reverb sea", "pad Cm7 | reverb Sea"],
  ["name", "my_kick-2: kick x", "2kick: kick x"],
];

describe("untzel.grammar against the EBNF of 03", () => {
  it.each(PRODUCTIONS)("%s", (_, valid, invalid) => {
    expect(hasSyntaxError(valid)).toBe(false);
    expect(hasSyntaxError(invalid)).toBe(true);
  });

  it("accepts the shapes measured in the design", () => {
    for (const source of ["kick x...\r\nhat ..x.\r\n", "x... x...", "kick x...x...", "sine: kick x", "loop: kick x", "b2: bass c2", "kick"]) {
      expect(hasSyntaxError(source)).toBe(false);
    }
  });
});
