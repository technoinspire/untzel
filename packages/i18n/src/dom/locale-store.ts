// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Where the choice of language is kept on this device, and how the docs links keep the
// reader on the same section.
import { matchLocale, type Locale } from "../locales";

export const LOCALE_STORAGE_KEY = "untzel.locale";

/** The slice of Storage this module needs; tests pass a Map-backed one. */
export interface LocaleStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The page's localStorage, or null where reading it throws (blocked storage, sandbox). */
export function browserLocaleStore(): LocaleStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSavedLocale(store: LocaleStore | null): Locale | null {
  try {
    const saved = store?.getItem(LOCALE_STORAGE_KEY);
    return saved == null ? null : matchLocale(saved);
  } catch {
    return null;
  }
}

/** Best effort: blocked storage only loses the choice for the next visit. */
export function saveLocale(store: LocaleStore | null, locale: Locale): void {
  try {
    store?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The choice still holds on this page.
  }
}

/**
 * The docs switch is a pair of links (it works without JavaScript). With JavaScript, a
 * click carries the current section anchor to the other language and saves the choice.
 */
export function enhanceLanguageLinks(root: ParentNode, store: LocaleStore | null, currentHash: () => string): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[data-locale-link]")) {
    link.addEventListener("click", () => {
      const locale = matchLocale(link.dataset["localeLink"] ?? "");
      if (locale !== null) saveLocale(store, locale);
      const hash = currentHash();
      if (hash.startsWith("#") && hash.length > 1) link.hash = hash;
    });
  }
}
