// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pages.json at the docs root: the pages in menu order with the file of each locale, relative
// to the docs root. The site builds its menu from this file, never from the app's sources.
import { LOCALES, type Locale } from "@untzel/i18n";
import { PAGE_IDS, type PageId } from "../../../../apps/docs/src/pages";

export const PAGES_INDEX_SCHEMA_VERSION = 1;

/** What the index needs from a built page: its id, its locale and its folder (pagePath). */
export interface IndexedPage {
  readonly id: PageId;
  readonly locale: Locale;
  readonly path: string;
}

export interface PagesIndexEntry {
  readonly id: PageId;
  readonly files: Readonly<Record<Locale, string>>;
}

function filesByPage(pages: readonly IndexedPage[]): Map<PageId, Map<Locale, string>> {
  const files = new Map<PageId, Map<Locale, string>>();
  for (const page of pages) {
    const locales = files.get(page.id) ?? new Map<Locale, string>();
    if (locales.has(page.locale)) throw new Error(`docs page ${page.id} appears twice in ${page.locale}`);
    locales.set(page.locale, `${page.path}index.html`);
    files.set(page.id, locales);
  }
  return files;
}

function entryOf(id: PageId, locales: ReadonlyMap<Locale, string> | undefined): PagesIndexEntry {
  const files = Object.fromEntries(
    LOCALES.map((locale) => {
      const file = locales?.get(locale);
      if (file === undefined) throw new Error(`docs page ${id} has no ${locale} file`);
      return [locale, file] as const;
    }),
  ) as Record<Locale, string>;
  return { id, files };
}

/** The serialized docs/pages.json: two-space JSON with a trailing newline, in PAGE_IDS order. */
export function pagesIndex(pages: readonly IndexedPage[]): string {
  const files = filesByPage(pages);
  const entries = PAGE_IDS.map((id) => entryOf(id, files.get(id)));
  return `${JSON.stringify({ schemaVersion: PAGES_INDEX_SCHEMA_VERSION, pages: entries }, null, 2)}\n`;
}
