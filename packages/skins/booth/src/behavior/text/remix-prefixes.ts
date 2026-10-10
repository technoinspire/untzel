// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The remix prefix of every language Untzel ships, whether or not its catalog has loaded:
// someone reading in English who opens a "Remix de X" link keeps "Remix de X", never
// "Remix of Remix de X". Written here, and not read from the catalogs, so
// the initial JS carries no translation (the bundle budget); remix-prefixes.test.ts
// keeps each entry equal to its catalog's remixPrefix, and a new locale does not compile
// without one.
import type { Locale } from "@untzel/i18n";

export const REMIX_PREFIX_BY_LOCALE: Readonly<Record<Locale, string>> = {
  en: "Remix of",
  "pt-BR": "Remix de",
};

export const REMIX_PREFIXES: readonly string[] = [...new Set(Object.values(REMIX_PREFIX_BY_LOCALE))];
