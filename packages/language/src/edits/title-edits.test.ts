// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import { quoteTitle, setTitleEdit } from "./title-edits";
function edited(source: string, title: string): string {
  const result = setTitleEdit(source, title);
  if (!result.ok) throw new Error(result.reason);
  return result.source;
}
describe("setTitleEdit", () => {
  it("replaces only the string of the title line", () => {
    const source = 'title "Old"   // keep me\ntempo 132\nkick x...';
    expect(edited(source, "Midnight Coast")).toBe('title "Midnight Coast"   // keep me\ntempo 132\nkick x...');
  });
  it("inserts the line before the first statement, under a template header", () => {
    const source = "// template: Midnight Bloom\n// order: 1\ntempo 124\nkick x...";
    expect(edited(source, "Midnight Bloom")).toBe('// template: Midnight Bloom\n// order: 1\ntitle "Midnight Bloom"\ntempo 124\nkick x...');
  });
  it("writes into an empty text", () => {
    expect(edited("", "Night")).toBe('title "Night"');
  });
  it("keeps the line break of the text", () => {
    expect(edited("tempo 120\r\nkick x...", "A")).toBe('title "A"\r\ntempo 120\r\nkick x...');
  });
  it('escapes " and \\ so the line always parses back to the same title', () => {
    const source = edited("kick x...", 'say "hi" \\ ok');
    expect(source).toBe('title "say \\"hi\\" \\\\ ok"\nkick x...');
    const result = analyze(source, registryWith());
    expect(result.ok && result.program.title).toBe('say "hi" \\ ok');
  });
  it("normalizes: no line break can enter, and the cut is at 60 code points", () => {
    expect(edited("kick x...", "A\nB")).toBe('title "AB"\nkick x...');
    expect(edited("kick x...", "🌊".repeat(70))).toBe(`title "${"🌊".repeat(60)}"\nkick x...`);
  });
  it("refuses an empty title and leaves the text alone", () => {
    expect(setTitleEdit("kick x...", "   ")).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });
  it("quotes", () => {
    expect(quoteTitle('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});
