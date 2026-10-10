// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Typed catalogs. The English catalog is the source and the type of the keys; a translation
// has the same shape, every key optional, and a missing key falls back to English.
import type { Formatters } from "./formatters";
import type { Locale } from "./locales";
import type { Translator } from "./translator";

export type Entry = string | ((...args: never[]) => string);
export type Catalog = Readonly<Record<string, Entry>>;
/** Same keys, every one optional; a text entry takes any text (sources are often `as const`). */
export type Translation<C extends Catalog> = { readonly [K in keyof C]?: C[K] extends string ? string : C[K] };

export interface TranslationModule<C extends Catalog> {
  readonly locale: Locale;
  readonly build: (formatters: Formatters) => Translation<C>;
}

/** One translation file: `export default defineTranslation<typeof source>("pt-BR", (f) => ({ ... }))`. */
export function defineTranslation<C extends Catalog>(
  locale: Locale,
  build: (formatters: Formatters) => Translation<C>,
): TranslationModule<C> {
  return { locale, build };
}

/** The translated entry of key, or the English one when it is missing or not of the same kind. */
function pick<C extends Catalog>(source: C, translation: Translation<C> | null, key: keyof C): C[keyof C] {
  const english = source[key];
  const translated = translation?.[key];
  if (translated === undefined || typeof translated !== typeof english) return english as C[keyof C];
  if (typeof english === "string") return translated as C[keyof C];
  const fallback = english as (...args: unknown[]) => string;
  const wrapped = (...args: unknown[]): string => {
    try {
      return (translated as (...args: unknown[]) => string)(...args);
    } catch {
      return fallback(...args);
    }
  };
  return wrapped as unknown as C[keyof C];
}

/** The catalog for one locale, resolved once: English where the translation has no key. */
export function translateCatalog<C extends Catalog>(
  source: C,
  translations: readonly TranslationModule<C>[],
  locale: Locale,
  formatters: Formatters,
): C {
  const module = translations.find((candidate) => candidate.locale === locale);
  const translation = module === undefined ? null : module.build(formatters);
  const entries = Object.keys(source).map((key) => [key, pick(source, translation, key)] as const);
  return Object.freeze(Object.fromEntries(entries)) as unknown as C;
}

/**
 * Same shape as the source; every read uses the translator's current locale. The list of
 * translations may grow after binding (a language loaded on demand); the resolved catalog
 * of a locale is rebuilt when it does.
 */
export function bindCatalog<C extends Catalog>(
  translator: Translator,
  source: C,
  translations: readonly TranslationModule<C>[],
): C {
  const cache = new Map<string, C>();
  const current = (): C => {
    const locale = translator.locale();
    const key = `${locale}:${translations.length}`;
    let catalog = cache.get(key);
    if (catalog === undefined) {
      catalog = translateCatalog(source, translations, locale, translator.formatters());
      cache.set(key, catalog);
    }
    return catalog;
  };
  const live = {};
  for (const key of Object.keys(source)) {
    Object.defineProperty(live, key, { enumerable: true, get: () => current()[key] });
  }
  return Object.freeze(live) as C;
}

export type Thunks<C extends Catalog> = {
  readonly [K in keyof C]: C[K] extends string
    ? () => string
    : C[K] extends (...args: infer A) => string
      ? (...args: A) => () => string
      : never;
};

/** Readers for text bindings: `text.play()` reads the live catalog again on every call. */
export function messagesOf<C extends Catalog>(live: C): Thunks<C> {
  const thunks: Record<string, unknown> = {};
  for (const key of Object.keys(live)) {
    thunks[key] =
      typeof live[key] === "string"
        ? () => live[key]
        : (...args: unknown[]) =>
            () =>
              (live[key] as (...values: unknown[]) => string)(...args);
  }
  return Object.freeze(thunks) as Thunks<C>;
}

export interface MessageRef<K extends string = string> {
  readonly key: K;
  readonly args: readonly unknown[];
  /** The English text, computed once. */
  readonly text: string;
}

export type Referenced<C extends Catalog> = {
  readonly [K in keyof C & string]: C[K] extends (...args: infer A) => string
    ? (...args: A) => MessageRef<K>
    : () => MessageRef<K>;
};

/** Each entry returns a reference (key, arguments, English text) that a view translates later. */
export function referenced<C extends Catalog>(source: C): Referenced<C> {
  const refs: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    const entry = source[key];
    refs[key] = (...args: unknown[]): MessageRef =>
      Object.freeze({
        key,
        args: Object.freeze([...args]),
        text: typeof entry === "string" ? entry : (entry as (...values: unknown[]) => string)(...args),
      });
  }
  return Object.freeze(refs) as Referenced<C>;
}
