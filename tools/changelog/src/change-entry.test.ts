// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { parseChangeEntry } from "./change-entry";

const valid = {
  category: "new",
  docs: "/docs/app/play-range",
  title: { en: "Play range", "pt-BR": "Trecho de execução" },
  body: { en: "Choose the stretch that plays.", "pt-BR": "Escolha o trecho que toca." },
};

describe("parseChangeEntry", () => {
  it("accepts an entry in both languages, without date or refs", () => {
    expect(parseChangeEntry(valid)).toEqual(valid);
  });
  it.each([
    [{ ...valid, category: "changed" }, /category/],
    [{ ...valid, title: { en: "Play range" } }, /title.pt-BR is missing/],
    [{ ...valid, body: { ...valid.body, es: "x" } }, /unknown languages/],
    [{ ...valid, docs: "https://example.com" }, /docs must be a path/],
    [{ ...valid, date: "05/10/2026" }, /date/],
    [{ ...valid, refs: [] }, /refs/],
    [{ ...valid, extra: 1 }, /unknown fields/],
    [{ ...valid, title: { en: "A trance loop", "pt-BR": "Um loop" } }, /genre/],
    [{ ...valid, body: { en: "Coming soon.", "pt-BR": "Em breve." } }, /soon/],
    [{ ...valid, title: { en: "x".repeat(81), "pt-BR": "y" } }, /longer than 80/],
  ])("rejects %j", (raw, message) => {
    expect(() => parseChangeEntry(raw)).toThrow(message);
  });
});
