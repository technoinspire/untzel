// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The locales of the system. English is the source language; adding a locale is one line
// here and one translation file per catalog.

export const LOCALES = ["en", "pt-BR"] as const;
export type Locale = (typeof LOCALES)[number];

export const SOURCE_LOCALE: Locale = "en";

/** Each locale named in itself, as the language switch shows it. */
export const ENDONYMS: Readonly<Record<Locale, string>> = {
  en: "English",
  "pt-BR": "Português",
};

/** Order of the switch: the first translation, then the source. */
export const SWITCH_ORDER: readonly Locale[] = ["pt-BR", "en"];

/** "pt", "pt-BR", "pt-PT" -> "pt-BR"; "en", "en-US" -> "en"; anything else -> null. */
export function matchLocale(tag: string): Locale | null {
  const language = tag.trim().toLowerCase().split(/[-_]/)[0];
  if (language === "pt") return "pt-BR";
  if (language === "en") return "en";
  return null;
}

export interface LocaleInputs {
  /** The explicit choice saved on this device. */
  readonly saved: string | null;
  /** The locale the host page declares (the site's data-locale). */
  readonly host: string | null;
  readonly navigatorLanguages: readonly string[];
}

/** Saved choice, then host, then the browser's languages, then English. Unknown values are ignored. */
export function resolveLocale(inputs: LocaleInputs): Locale {
  const candidates = [inputs.saved, inputs.host, ...inputs.navigatorLanguages];
  for (const candidate of candidates) {
    if (candidate === null) continue;
    const locale = matchLocale(candidate);
    if (locale !== null) return locale;
  }
  return SOURCE_LOCALE;
}
