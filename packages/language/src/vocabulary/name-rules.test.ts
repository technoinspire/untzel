// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { NAME_MAX_LENGTH } from "@untzel/core";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_NAME_LENGTH } from "../limits";
import { RESERVED_WORDS, checkName } from "./name-rules";

describe("checkName", () => {
  it("accepts a free, well formed name", () => {
    expect(checkName("hats", new Set(["hat"]))).toBeNull();
  });

  it("refuses a malformed name, a word of the language and a taken name, in that order", () => {
    expect(checkName("open hat", new Set())).toBe("INVALID_NAME");
    expect(checkName("x".repeat(25), new Set())).toBe("INVALID_NAME");
    expect(checkName("section", new Set(["section"]))).toBe("RESERVED_NAME");
    expect(checkName("env", new Set())).toBe("RESERVED_NAME");
    expect(checkName("hat", new Set(["hat"]))).toBe("NAME_TAKEN");
  });

  it("reserves exactly the kw<…> terms of the grammar", () => {
    const grammar = readFileSync(new URL("../untzel.grammar", import.meta.url), "utf8");
    const keywords = new Set([...grammar.matchAll(/kw<"([a-z]+)">/g)].map((match) => match[1]));
    expect(new Set(RESERVED_WORDS)).toEqual(keywords);
  });

  it("keeps the language limit and core's name length equal", () => {
    expect(MAX_NAME_LENGTH).toBe(NAME_MAX_LENGTH);
  });
});
