// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { highlightTree } from "@lezer/highlight";
import { untzelParser } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { TOKEN_CLASSES, untzelHighlightStyle } from "./syntax";

// Every category of the token table gets its own class. Fails if the highlighting collapses (the code reads as a .txt again).

const SAMPLE = `// comment
tempo 132
key c minor
kick:  kick  x... ~ | reverb sea | delay 1/8
bass:  bass  c2 Cm  | cutoff sine(8) 300..1400
section drop kick bass
song drop 8
`;

function classesOf(source: string): Map<string, string> {
  const out = new Map<string, string>();
  highlightTree(untzelParser.parse(source), untzelHighlightStyle, (from, to, classes) => {
    const text = source.slice(from, to);
    if (!out.has(text)) out.set(text, classes);
  });
  return out;
}

describe("Untzel highlighting", () => {
  const classes = classesOf(SAMPLE);

  it.each([
    ["tempo", TOKEN_CLASSES.keyword],
    ["section", TOKEN_CLASSES.keyword],
    ["sine", TOKEN_CLASSES.signal],
    ["kick", TOKEN_CLASSES.track],
    ["bass", TOKEN_CLASSES.track],
    ["c", TOKEN_CLASSES.pitch],
    ["c2", TOKEN_CLASSES.pitch],
    ["Cm", TOKEN_CLASSES.pitch],
    ["x...", TOKEN_CLASSES.hits],
    ["~", TOKEN_CLASSES.sustain],
    ["reverb", TOKEN_CLASSES.param],
    ["sea", TOKEN_CLASSES.value],
    ["132", TOKEN_CLASSES.number],
    ["drop", TOKEN_CLASSES.member],
    ["|", TOKEN_CLASSES.punct],
    ["// comment", TOKEN_CLASSES.comment],
  ])("%s has its class", (text, className) => {
    expect(classes.get(text)).toBe(className);
  });

  it("instrument words and song parts have theirs", () => {
    const instrument = classesOf("k: kick x...").get("kick");
    expect(instrument).toBe(TOKEN_CLASSES.instrument);
    expect(classesOf("song intro 8").get("intro")).toBe(TOKEN_CLASSES.section);
  });

  it("sounds, accents, stacks, flags and env have theirs (instrument library grammar)", () => {
    const line = classesOf("pad: pad sea c4+e4! ~ | free | brightness env(1) 0.2..0.8");
    expect(line.get("sea")).toBe(TOKEN_CLASSES.sound);
    expect(line.get("!")).toBe(TOKEN_CLASSES.accent);
    expect(line.get("+")).toBe(TOKEN_CLASSES.punct);
    expect(line.get("free")).toBe(TOKEN_CLASSES.param);
    expect(line.get("env")).toBe(TOKEN_CLASSES.signal);
  });

  it("never collapses to one class", () => {
    expect(new Set(classes.values()).size).toBeGreaterThanOrEqual(10);
  });
});
