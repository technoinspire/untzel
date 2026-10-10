// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What pnpm i18n:check decides. Failures:
// a key of the English source with no entry in a translation, a key the source does not
// have, a text where the source has a function or the reverse, a different number of
// parameters, a declared parameter the translation never uses, and a translated page whose
// headings, directives or examples differ from its source. At run time a missing key still
// falls back to English, so the music and the interface never break; the check is what
// keeps every catalog complete. Untranslated pages are only reported: they show in English.
import { createFormatters, type Catalog, type Locale, type TranslationModule } from "@untzel/i18n";

export interface CatalogReport {
  readonly name: string;
  readonly locale: Locale;
  readonly translated: number;
  readonly total: number;
  readonly missing: readonly string[];
  readonly failures: readonly string[];
}

/** The parameter names of an arrow or function expression, from its source text. */
export function parameterNames(fn: (...args: never[]) => string): readonly string[] {
  const text = fn.toString();
  const list = /^\s*(?:async\s*)?(?:function\b[^(]*)?\(([^)]*)\)/.exec(text)?.[1] ?? /^\s*([A-Za-z_$][\w$]*)\s*=>/.exec(text)?.[1] ?? "";
  return list
    .split(",")
    .map((part) => part.trim().replace(/[:=].*$/s, "").trim())
    .filter((name) => name !== "");
}

/** The body of a function after its parameter list. */
function bodyOf(fn: (...args: never[]) => string): string {
  const text = fn.toString();
  const arrow = text.indexOf("=>");
  const brace = text.indexOf("{");
  if (arrow >= 0 && (brace < 0 || arrow < brace)) return text.slice(arrow + 2);
  return brace >= 0 ? text.slice(brace) : text;
}

/** Parameters declared but never read; a leading underscore says "unused on purpose". */
export function unusedParameters(fn: (...args: never[]) => string): readonly string[] {
  const body = bodyOf(fn);
  return parameterNames(fn).filter((name) => !name.startsWith("_") && !new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(body));
}

export function checkCatalog(name: string, source: Catalog, module: TranslationModule<Catalog>): CatalogReport {
  const translation = module.build(createFormatters(module.locale)) as Readonly<Record<string, unknown>>;
  const failures: string[] = [];
  const sourceKeys = Object.keys(source);
  for (const key of Object.keys(translation)) {
    const english = source[key];
    const translated = translation[key];
    if (english === undefined) {
      failures.push(`${name} [${module.locale}]: "${key}" is not a key of the English source`);
      continue;
    }
    if (typeof english !== typeof translated) {
      failures.push(`${name} [${module.locale}]: "${key}" is a ${typeof english === "function" ? "function" : "text"} in English and a ${typeof translated === "function" ? "function" : "text"} here`);
      continue;
    }
    if (typeof english !== "function" || typeof translated !== "function") continue;
    const fn = translated as (...args: never[]) => string;
    if (english.length !== fn.length) {
      failures.push(`${name} [${module.locale}]: "${key}" takes ${fn.length} parameter(s), English takes ${english.length}`);
    }
    const unused = unusedParameters(fn);
    if (unused.length > 0) failures.push(`${name} [${module.locale}]: "${key}" never uses ${unused.join(", ")}`);
  }
  const missing = sourceKeys.filter((key) => translation[key] === undefined);
  for (const key of missing) failures.push(`${name} [${module.locale}]: "${key}" has no translation`);
  return { name, locale: module.locale, translated: sourceKeys.length - missing.length, total: sourceKeys.length, missing, failures };
}

/** What a translated page must keep from its source, in order. */
export function pageShape(markdown: string): { readonly headings: readonly string[]; readonly directives: readonly string[] } {
  const headings = [...markdown.matchAll(/^(#{1,6})\s.*?\{#([a-z0-9-]+)\}\s*$/gm)].map((match) => `h${match[1]?.length ?? 0}#${match[2] ?? ""}`);
  const directives = [...markdown.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => (match[1] ?? "").trim().replace(/\s+/g, " "));
  return { headings, directives };
}

export function checkPage(file: string, source: string, translation: string): readonly string[] {
  const a = pageShape(source);
  const b = pageShape(translation);
  const failures: string[] = [];
  if (a.headings.join(" ") !== b.headings.join(" ")) failures.push(`${file}: headings differ from the English source\n    en:   ${a.headings.join(" ")}\n    here: ${b.headings.join(" ")}`);
  if (a.directives.join(" | ") !== b.directives.join(" | ")) failures.push(`${file}: directives or examples differ from the English source\n    en:   ${a.directives.join(" | ")}\n    here: ${b.directives.join(" | ")}`);
  return failures;
}
