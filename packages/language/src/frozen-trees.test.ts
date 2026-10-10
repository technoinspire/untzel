// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parser } from "./read/parser";

// Every text the first grammar accepted keeps exactly the same syntax tree. The fixture was
// frozen from that grammar and is never edited by hand.

interface FrozenTrees {
  readonly grammarCommit: string;
  readonly entries: readonly { readonly text: string; readonly tree: string }[];
}

const frozen = JSON.parse(
  readFileSync(new URL("./fixtures/phase1-trees.json", import.meta.url), "utf8"),
) as FrozenTrees;

describe("frozen corpus", () => {
  it("was frozen from the first grammar", () => {
    expect(frozen.grammarCommit).toBe("3c98537");
    expect(frozen.entries.length).toBeGreaterThan(400);
  });

  it("parses every frozen text to the same tree", () => {
    const changed = frozen.entries.filter(({ text, tree }) => parser.parse(text).toString() !== tree);
    expect(changed.map(({ text }) => text)).toEqual([]);
  });
});
