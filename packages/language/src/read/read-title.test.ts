// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "./analyze";
import { titleOf, unquoteTitle } from "./read-title";
const registry = registryWith();
function read(source: string) {
  const result = analyze(source, registry);
  return result.ok
    ? { title: result.program.title, codes: result.warnings.map((warning) => [warning.code, warning.severity]) }
    : { title: undefined, codes: result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.severity]) };
}
describe("the title line", () => {
  it("names the song and stays out of the sound", () => {
    expect(read('title "Midnight Coast"\nkick x...')).toEqual({ title: "Midnight Coast", codes: [] });
  });
  it("is optional: no line reads as null", () => {
    expect(read("kick x...")).toEqual({ title: null, codes: [] });
  });
  it("reads the escapes back", () => {
    expect(read('title "say \\"hi\\" \\\\ ok"\nkick x...').title).toBe('say "hi" \\ ok');
    expect(unquoteTitle('"a\\"b\\\\c"')).toBe('a"b\\c');
  });
  it("normalizes white space", () => {
    expect(read('title "  Night    Drive "\nkick x...').title).toBe("Night Drive");
  });
  it("an empty title is a warning and reads as null; the program still plays", () => {
    expect(read('title ""\nkick x...')).toEqual({ title: null, codes: [["EMPTY_TITLE", "warning"]] });
  });
  it("a long title is a warning and keeps the first 60 code points", () => {
    const result = read(`title "${"b".repeat(70)}"\nkick x...`);
    expect(result).toEqual({ title: "b".repeat(60), codes: [["TITLE_TOO_LONG", "warning"]] });
  });
  it("a second title line is an error, like a second tempo", () => {
    expect(read('title "A"\ntitle "B"\nkick x...').codes).toEqual([["DUPLICATE_STATEMENT", "error"]]);
  });
  it("comes before tracks, like every global", () => {
    expect(read('kick x...\ntitle "A"').codes).toEqual([["OUT_OF_ORDER", "error"]]);
  });
  it("leaves title: as a valid track name", () => {
    expect(read("title: kick x...")).toEqual({ title: null, codes: [] });
  });
  it("alone on a line needs a value", () => {
    expect(read("title\nkick x...").codes).toEqual([["MISSING_VALUE", "error"]]);
  });
});
describe("titleOf", () => {
  it("reads the title without analyzing the rest", () => {
    expect(titleOf('// template: X\ntitle "Night Drive"\nkick: nope x...')).toBe("Night Drive");
    expect(titleOf("kick x...")).toBeNull();
    expect(titleOf('title ""')).toBeNull();
  });
});
