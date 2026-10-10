// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The language of the page, one translator for the shell, the editor and the
// announcements. Resolution order: the
// choice saved on this device, the data-locale the site writes on #app, the browser's
// languages, English. #app[lang] always says the language the interface is written in.
import { createTranslator, resolveLocale, type Locale, type Translator } from "@untzel/i18n";
import { browserLocaleStore, readSavedLocale } from "@untzel/i18n/dom";
import { installAnnouncements } from "./copy";
import { loadLanguage } from "./languages";

let translator: Translator | null = null;

/** The language the page opens in; main.ts loads its catalogs before the first screen. */
export function initialLocale(root: HTMLElement): Locale {
  return resolveLocale({
    saved: readSavedLocale(browserLocaleStore()),
    host: root.dataset["locale"] ?? null,
    navigatorLanguages: navigator.languages,
  });
}
/** A switch waits for the language's catalogs, then changes it; a failed load keeps the current one. */
function loadingFirst(base: Translator): Translator {
  return {
    ...base,
    setLocale(locale) {
      loadLanguage(locale).then(() => base.setLocale(locale), (error: unknown) => console.warn(`Untzel couldn't load ${locale}`, error));
    },
  };
}
export function appTranslator(root: HTMLElement): Translator {
  if (translator !== null) return translator;
  const created = loadingFirst(createTranslator(initialLocale(root)));
  translator = created;
  installAnnouncements(created);
  root.lang = created.locale();
  created.onChange((locale) => (root.lang = locale));
  return created;
}
