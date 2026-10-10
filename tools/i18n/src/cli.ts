// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm i18n:check: coverage per locale and catalog, and the failures of check.ts.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, SOURCE_LOCALE } from "@untzel/i18n";
import { CATALOGS, DOCS_CONTENT } from "./catalogs";
import { checkCatalog, checkPage } from "./check";

export interface CliEnvironment {
  readonly repo: string;
}

function percent(done: number, total: number): string {
  return total === 0 ? "100%" : `${Math.floor((done / total) * 1000) / 10}%`;
}

export async function main(_args: readonly string[], environment: CliEnvironment): Promise<number> {
  const failures: string[] = [];
  console.log("i18n:check");
  for (const catalog of CATALOGS) {
    for (const module of catalog.translations) {
      const report = checkCatalog(catalog.name, catalog.source, module);
      failures.push(...report.failures);
      const missing = report.missing.length === 0 ? "" : `, missing: ${report.missing.join(", ")}`;
      console.log(`  ${percent(report.translated, report.total).padStart(6)}  ${report.locale}  ${catalog.name} (${report.translated}/${report.total}${missing})`);
    }
    const covered = new Set(catalog.translations.map((module) => module.locale));
    for (const locale of LOCALES) {
      if (locale !== SOURCE_LOCALE && !covered.has(locale)) console.log(`      0%  ${locale}  ${catalog.name} (no translation module)`);
    }
  }
  const content = join(environment.repo, DOCS_CONTENT);
  const sources = readdirSync(content).filter((file) => /^[a-z-]+\.md$/.test(file)).sort();
  for (const locale of LOCALES.filter((candidate) => candidate !== SOURCE_LOCALE)) {
    let translated = 0;
    for (const file of sources) {
      const translation = file.replace(/\.md$/, `.${locale}.md`);
      if (!existsSync(join(content, translation))) continue;
      translated += 1;
      failures.push(...checkPage(`${DOCS_CONTENT}/${translation}`, readFileSync(join(content, file), "utf8"), readFileSync(join(content, translation), "utf8")));
    }
    const untranslated = sources.filter((file) => !existsSync(join(content, file.replace(/\.md$/, `.${locale}.md`))));
    const note = untranslated.length === 0 ? "" : `, shown in English: ${untranslated.join(", ")}`;
    console.log(`  ${percent(translated, sources.length).padStart(6)}  ${locale}  docs pages (${translated}/${sources.length}${note})`);
  }
  if (failures.length > 0) {
    console.error(`i18n:check FAIL, ${failures.length} problem(s):`);
    for (const failure of failures) console.error(`  ${failure}`);
    return 1;
  }
  console.log("i18n:check PASS");
  return 0;
}
