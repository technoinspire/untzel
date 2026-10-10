// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The menu's Language group talks to this port only. The language control
// implements it over the translator: choose saves the locale and switches the copy
// without a reload, and never stops the music.
import { switchModel, type Locale } from "@untzel/i18n";
export type MenuLocale = Locale;
export interface LanguageChoice {
  current(): MenuLocale;
  choose(locale: MenuLocale): void;
}
/** One radio of the Language group: the endonym, its lang, and whether it is the current one. */
export interface LanguageOption {
  readonly locale: MenuLocale;
  readonly label: string;
  readonly lang: string;
  readonly isCurrent: boolean;
}
/** The switch's own order and endonyms (switchModel); names of languages are never translated. */
export function languageOptions(current: MenuLocale): readonly LanguageOption[] {
  return switchModel(current).map((item) => ({ locale: item.locale, label: item.label, lang: item.lang, isCurrent: item.current }));
}
