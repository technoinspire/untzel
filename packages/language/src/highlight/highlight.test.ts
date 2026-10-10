// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { readFileSync } from "node:fs";
import type { SyntaxNodeRef, Tree } from "@lezer/common";
import { highlightTree, tagHighlighter } from "@lezer/highlight";
import { describe, expect, it } from "vitest";
import {
  GRAMMAR_PUNCTUATION,
  GRAMMAR_WORDS,
  NAME_CONTEXTS,
  TOKEN_CATEGORIES,
  TOKEN_TAGS,
  WORD_CONTEXTS,
  untzelParser,
  type TokenCategory,
} from "./highlight";

// The highlighting follows the
// grammar. These tests read untzel.grammar itself, so a word, a rule or a token the
// parser gains fails here until the Code panel colours it.

const GRAMMAR = readFileSync(new URL("../untzel.grammar", import.meta.url), "utf8");

/** Every construct the parser accepts: each node type of the grammar appears at least once. */
const EVERY_CONSTRUCT = `// every construct of the grammar
title "Night \\"Drive\\""
tempo 138
key d minor
swing 0.1
loop 8
kick:   kick    punch    x... X.~. [x x]?0.5 x*2 x! / x...  | drive 0.3 | reverb sea | delay 3/16 | free
lead:   lead    classic  c2 . Cm ~ c4+e4+g4 bb4!           | cutoff sine(8) 300..2400 | gain tri(4) 0..1
pad:    pad     sea      Dm ~ ~ ~                          | pan saw(2) -1..1 | duck square(1) 0..1 | tone rand(1/2) 0..1 | voicing spread
choir:  choir   aah      Dm ~ ~ ~                          | brightness env(1) 0.2..0.8 | audible 1
square: square  a2 . . .
section drop kick lead pad choir | tempo 128 | swing 0.1 | gain 0.8 | loop
song drop 8, drop 4 | loop
`;

const categoryOf = tagHighlighter(
  (Object.entries(TOKEN_TAGS) as [TokenCategory, (typeof TOKEN_TAGS)[TokenCategory]][]).map(([category, tag]) => ({ tag, class: category })),
);

/** The category of every character of the source, or "" where nothing is coloured. */
function categories(source: string, tree: Tree): string[] {
  const out: string[] = Array.from({ length: source.length }, () => "");
  highlightTree(tree, categoryOf, (from, to, classes) => out.fill(classes, from, to));
  return out;
}

interface Leaf {
  readonly name: string;
  readonly text: string;
  readonly from: number;
  readonly to: number;
}

function leaves(source: string, tree: Tree): Leaf[] {
  const out: Leaf[] = [];
  tree.iterate({
    enter: (node: SyntaxNodeRef) => {
      if (node.node.firstChild === null) out.push({ name: node.name, text: source.slice(node.from, node.to), from: node.from, to: node.to });
    },
  });
  return out;
}

const tree = untzelParser.parse(EVERY_CONSTRUCT);
const coloured = categories(EVERY_CONSTRUCT, tree);
const sampleLeaves = leaves(EVERY_CONSTRUCT, tree);

/** The category of the n-th occurrence of `text` as a whole token of the sample. */
function categoryAt(text: string, occurrence = 0): string | undefined {
  const leaf = sampleLeaves.filter((candidate) => candidate.text === text)[occurrence];
  return leaf === undefined ? undefined : coloured[leaf.from];
}

/** "Track { (TrackName ":")? … }" -> rule names whose body uses a plain Name. */
function rulesUsingName(): string[] {
  const rules = GRAMMAR.slice(0, GRAMMAR.indexOf("@tokens"));
  return [...rules.matchAll(/^(\w+) \{(.*)\}$/gm)].filter(([, , body]) => /\bName\b/.test(body ?? "")).map(([, rule]) => rule ?? "");
}

describe("highlighting follows the grammar", () => {
  const nodeNames = new Set(untzelParser.nodeSet.types.map((type) => type.name).filter((name) => name !== ""));

  it("the sample parses without errors and holds every node type of the grammar", () => {
    const seen = new Set<string>();
    tree.iterate({ enter: (node) => void seen.add(node.name) });
    expect(seen).not.toContain("⚠");
    for (const name of nodeNames) if (name !== "⚠") expect(seen, `the sample needs a ${name}`).toContain(name);
  });

  it("every word the grammar declares is a word of the parser and is coloured", () => {
    const declared = [...GRAMMAR.matchAll(/kw<"([a-z]+)">/g)].map(([, word]) => word ?? "");
    expect(declared.length).toBeGreaterThan(0);
    for (const word of declared) {
      expect(nodeNames, `the parser reads ${word}`).toContain(word);
      expect(GRAMMAR_WORDS, `${word} is a word the highlighter knows`).toContain(word);
      const occurrences = sampleLeaves.filter((leaf) => leaf.name === word);
      expect(occurrences.length, `the sample uses ${word} as a word`).toBeGreaterThan(0);
      for (const leaf of occurrences) expect(coloured[leaf.from], `${word} at ${leaf.from}`).not.toBe("");
    }
  });

  it("every token of the sample is coloured, whole", () => {
    for (const leaf of sampleLeaves) {
      const uncoloured = coloured.slice(leaf.from, leaf.to).some((category) => category === "");
      expect(uncoloured, `${leaf.name} "${leaf.text}" at ${leaf.from}`).toBe(false);
    }
  });

  it("every rule that holds a plain name says what the name means", () => {
    expect(rulesUsingName().sort()).toEqual(Object.keys(NAME_CONTEXTS).sort());
  });

  it("the tables name nodes and categories that exist", () => {
    const named = [...Object.keys(TOKEN_CATEGORIES).map((key) => key.replace(/!$/, "")), ...Object.keys(NAME_CONTEXTS), ...Object.keys(WORD_CONTEXTS)];
    for (const name of named) expect(nodeNames, name).toContain(name);
    expect(GRAMMAR_PUNCTUATION).toEqual(expect.arrayContaining(["|", ":", ",", "/", "..", "!", "+"]));
  });

  it.each([
    ["tempo", 0, "keyword"],
    ["key", 0, "keyword"],
    ["section", 0, "keyword"],
    ["song", 0, "keyword"],
    ["sine", 0, "signal"],
    ["env", 0, "signal"],
    ["square", 0, "signal"],
    ["square", 1, "track"],
    ["square", 2, "instrument"],
    ["kick", 0, "track"],
    ["kick", 1, "instrument"],
    ["choir", 1, "instrument"],
    ["punch", 0, "sound"],
    ["aah", 0, "sound"],
    ["d", 0, "pitch"],
    ["minor", 0, "value"],
    ["c2", 0, "pitch"],
    ["Cm", 0, "pitch"],
    ["e4", 0, "pitch"],
    ["+", 0, "punct"],
    ["!", 0, "accent"],
    ["x...", 0, "hits"],
    ["~", 0, "sustain"],
    ["drive", 0, "param"],
    ["free", 0, "param"],
    ["audible", 0, "param"],
    ["tempo", 1, "param"],
    ["swing", 1, "param"],
    ["loop", 1, "param"],
    ["loop", 2, "keyword"],
    ["sea", 0, "value"],
    ["sea", 1, "sound"],
    ["spread", 0, "value"],
    ["138", 0, "number"],
    ["drop", 0, "member"],
    ["drop", 1, "section"],
    ["|", 0, "punct"],
    ["..", 0, "punct"],
    ["// every construct of the grammar", 0, "comment"],
  ] as const)("%s (#%i) is %s", (text, occurrence, category) => {
    expect(categoryAt(text, occurrence)).toBe(category);
  });
});
