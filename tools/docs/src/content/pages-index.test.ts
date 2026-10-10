// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { LOCALES } from "@untzel/i18n";
import { describe, expect, it } from "vitest";
import { PAGE_IDS } from "../../../../apps/docs/src/pages";
import { pagesIndex, type IndexedPage } from "./pages-index";
import { pagePath } from "./site";

/** Every page in every locale, in the order renderPages produces them (locale first). */
function builtPages(): IndexedPage[] {
  return LOCALES.flatMap((locale) => PAGE_IDS.map((id) => ({ id, locale, path: pagePath(id, locale) })));
}

describe("pagesIndex", () => {
  it("lists every page in menu order with schema version 1", () => {
    const index = JSON.parse(pagesIndex([...builtPages()].reverse())) as { schemaVersion: number; pages: { id: string }[] };
    expect(index.schemaVersion).toBe(1);
    expect(index.pages.map((page) => page.id)).toEqual([...PAGE_IDS]);
  });

  it("gives both locales, with the start page at the root of each", () => {
    const index = JSON.parse(pagesIndex(builtPages())) as { pages: { id: string; files: Record<string, string> }[] };
    expect(index.pages[0]).toEqual({ id: "start", files: { en: "en/index.html", "pt-BR": "index.html" } });
    expect(index.pages.find((page) => page.id === "language")?.files).toEqual({ en: "en/language/index.html", "pt-BR": "language/index.html" });
  });

  it("is two-space JSON with a trailing newline", () => {
    const text = pagesIndex(builtPages());
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  });

  it("throws when a page misses a locale", () => {
    const pages = builtPages().filter((page) => !(page.id === "credits" && page.locale === "pt-BR"));
    expect(() => pagesIndex(pages)).toThrow(/credits has no pt-BR file/);
  });

  it("throws when a page appears twice in a locale", () => {
    const pages = builtPages();
    expect(() => pagesIndex([...pages, { id: "app", locale: "en", path: "en/app/" }])).toThrow(/app appears twice in en/);
  });
});
