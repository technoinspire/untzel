// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { createFormatters, LOCALES, translateCatalog, type Locale } from "@untzel/i18n";
import { describe, expect, it } from "vitest";
import { controlsPortuguese } from "../../copy/portuguese";
import { REMIX_PREFIX_BY_LOCALE, REMIX_PREFIXES } from "./remix-prefixes";
import { strings } from "../../copy/strings";

/** Each locale's own remixPrefix, read from its catalog. */
function catalogPrefix(locale: Locale): string {
  if (locale === "en") return strings.remixPrefix;
  return translateCatalog(strings, [controlsPortuguese.strings], locale, createFormatters(locale)).remixPrefix;
}

describe("the remix prefixes", () => {
  it("are the catalogs' remixPrefix, one per shipped locale", () => {
    for (const locale of LOCALES) expect(REMIX_PREFIX_BY_LOCALE[locale]).toBe(catalogPrefix(locale));
    expect(REMIX_PREFIXES).toEqual(["Remix of", "Remix de"]);
  });
});
