// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The instruments' and sounds' descriptions the library and the sound picker show, in the
// page's language. The English text is the manifest's own, passed in by the caller, so
// this module never imports the manifests; the translation is
// instruments.pt-BR.ts, checked against the manifests by pnpm i18n:check.
import type { Locale } from "@untzel/i18n";
import { pageTranslator } from "./copy";
import type { instrumentText } from "./instruments";
import instrumentsPortuguese from "./instruments.pt-BR";
import { soundKey } from "./sound-key";

const TRANSLATIONS = [instrumentsPortuguese];
const built = new Map<Locale, Readonly<Record<string, string | undefined>>>();

function translated(key: string): string | undefined {
  const locale = pageTranslator.locale();
  let catalog = built.get(locale);
  if (catalog === undefined) {
    const module = TRANSLATIONS.find((candidate) => candidate.locale === locale);
    catalog = module === undefined ? {} : (module.build(pageTranslator.formatters()) as Partial<typeof instrumentText>);
    built.set(locale, catalog);
  }
  return catalog[key];
}

/** The instrument's description in the current language; the manifest's own text otherwise. */
export function instrumentDescription(instrument: string, english: string): string {
  return translated(instrument) ?? english;
}

export function soundDescription(instrument: string, sound: string, english: string): string {
  return translated(soundKey(instrument, sound)) ?? english;
}
