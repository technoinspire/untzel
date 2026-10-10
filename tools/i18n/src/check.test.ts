// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { defineTranslation, type Catalog, type TranslationModule } from "@untzel/i18n";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOGS } from "./catalogs";
import { checkCatalog, checkPage, parameterNames, unusedParameters } from "./check";

const source = {
  play: "Play",
  bars: (count: number): string => `${count} bars`,
  trackIn: (track: string, section: string): string => `${track} in ${section}`,
} as const;

function check(build: () => Record<string, unknown>) {
  const module = defineTranslation<Catalog>("pt-BR", build as never) as TranslationModule<Catalog>;
  return checkCatalog("test", source, module);
}

/** The failures besides the missing keys, for the tests about one malformed entry. */
function malformed(build: () => Record<string, unknown>): readonly string[] {
  return check(build).failures.filter((failure) => !failure.endsWith("has no translation"));
}

describe("checkCatalog", () => {
  it("passes a complete, well-formed translation", () => {
    const report = check(() => ({ play: "Tocar", bars: (count: number) => `${count} compassos`, trackIn: (track: string, section: string) => `${track} em ${section}` }));
    expect(report.failures).toEqual([]);
    expect(report.translated).toBe(3);
  });

  it("fails on every key of the source without a translation", () => {
    const report = check(() => ({ play: "Tocar" }));
    expect(report.missing).toEqual(["bars", "trackIn"]);
    expect(report.failures).toEqual(['test [pt-BR]: "bars" has no translation', 'test [pt-BR]: "trackIn" has no translation']);
  });

  it("fails on a key the source does not have", () => {
    expect(malformed(() => ({ plya: "Tocar" }))).toEqual(['test [pt-BR]: "plya" is not a key of the English source']);
  });

  it("fails on a text where the source has a function", () => {
    expect(malformed(() => ({ bars: "compassos" }))[0]).toContain('"bars" is a function in English and a text here');
  });

  it("fails on a different number of parameters", () => {
    expect(malformed(() => ({ trackIn: (track: string) => `${track}` }))[0]).toContain("takes 1 parameter(s), English takes 2");
  });

  it("fails on a parameter the translation never uses", () => {
    expect(malformed(() => ({ trackIn: (track: string, _section: string) => track }))).toEqual([]);
    expect(malformed(() => ({ trackIn: (track: string, section: string) => `${track} sectionless` }))[0]).toContain("never uses section");
  });
});

describe("parameters from the source text", () => {
  it("reads arrows, single parameters and functions", () => {
    expect(parameterNames((a: string, b: number) => `${a}${b}`)).toEqual(["a", "b"]);
    expect(parameterNames(((value: string) => value) as never)).toEqual(["value"]);
    expect(parameterNames(function named(first: string) { return first; })).toEqual(["first"]);
    expect(unusedParameters((step: number, value: string) => `${step}`)).toEqual(["value"]);
  });
});

describe("checkPage", () => {
  const english = "# Title {#title}\n\n## One {#one}\n\n{{example first}}\n";
  it("passes when ids, levels and directives match in order", () => {
    expect(checkPage("p.pt-BR.md", english, "# Título {#title}\n\n## Um {#one}\n\n{{example first}}\n")).toEqual([]);
  });
  it("fails on a different heading id or a missing directive", () => {
    const failures = checkPage("p.pt-BR.md", english, "# Título {#titulo}\n\n## Um {#one}\n");
    expect(failures).toHaveLength(2);
  });
});

describe("the catalogs of the system", () => {
  it("are complete and well formed in every translation", () => {
    for (const catalog of CATALOGS) {
      for (const module of catalog.translations) {
        const report = checkCatalog(catalog.name, catalog.source, module);
        expect(report.failures, catalog.name).toEqual([]);
        expect(report.missing, catalog.name).toEqual([]);
      }
    }
  });

  it("fail when a real translation loses a key or keeps one the source dropped", () => {
    for (const catalog of CATALOGS) {
      for (const module of catalog.translations) {
        const [first] = Object.keys(catalog.source);
        if (first === undefined) continue;
        const without = defineTranslation<Catalog>(module.locale, (formatters) => {
          const { [first]: _dropped, ...rest } = module.build(formatters) as Record<string, unknown>;
          return rest as never;
        }) as TranslationModule<Catalog>;
        expect(checkCatalog(catalog.name, catalog.source, without).failures, catalog.name).toContain(`${catalog.name} [${module.locale}]: "${first}" has no translation`);
        const stale = defineTranslation<Catalog>(module.locale, (formatters) => ({ ...(module.build(formatters) as object), keyTheSourceDropped: "x" }) as never) as TranslationModule<Catalog>;
        expect(checkCatalog(catalog.name, catalog.source, stale).failures, catalog.name).toContain(`${catalog.name} [${module.locale}]: "keyTheSourceDropped" is not a key of the English source`);
      }
    }
  });

  it("include every translation file of the repository", () => {
    const repo = fileURLToPath(new URL("../../../", import.meta.url));
    const registry = readFileSync(join(repo, "tools/i18n/src/catalogs.ts"), "utf8");
    const files = ["apps", "packages"].flatMap((folder) => translationFiles(join(repo, folder))).map((file) => relative(repo, file));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(registry, `${file} is not in tools/i18n/src/catalogs.ts`).toContain(file.replace(/\.ts$/, ""));
  });
});

/** Every *.pt-BR.ts (or other locale) source file below folder, outside node_modules and builds. */
function translationFiles(folder: string): readonly string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return ["node_modules", "dist", "generated"].includes(entry.name) ? [] : translationFiles(path);
    return /(^|\.)[a-z]{2}-[A-Z]{2}\.ts$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}
