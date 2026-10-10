// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The current locale and who to tell when it changes. No DOM, no storage: the adapters
// persist the choice and refresh their own text.
import { createFormatters, type Formatters } from "./formatters";
import { SOURCE_LOCALE, type Locale } from "./locales";

export type LocaleListener = (locale: Locale) => void;

export interface Translator {
  locale(): Locale;
  setLocale(locale: Locale): void;
  /** Returns the function that unsubscribes. */
  onChange(listener: LocaleListener): () => void;
  formatters(): Formatters;
}

export function createTranslator(initial: Locale): Translator {
  let current = initial;
  const listeners = new Set<LocaleListener>();
  const formatters = new Map<Locale, Formatters>();
  return {
    locale: () => current,
    setLocale(locale) {
      if (locale === current) return;
      current = locale;
      for (const listener of [...listeners]) listener(locale);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    formatters() {
      let value = formatters.get(current);
      if (value === undefined) {
        value = createFormatters(current);
        formatters.set(current, value);
      }
      return value;
    },
  };
}

export interface TranslatorSlot extends Translator {
  /** From now on every call goes to translator; listeners move with it. */
  install(translator: Translator): void;
}

/** A Translator that answers in English until the composition installs the real one. */
export function createTranslatorSlot(): TranslatorSlot {
  let target: Translator = createTranslator(SOURCE_LOCALE);
  const listeners = new Set<LocaleListener>();
  let detach = target.onChange((locale) => listeners.forEach((listener) => listener(locale)));
  return {
    locale: () => target.locale(),
    setLocale: (locale) => target.setLocale(locale),
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    formatters: () => target.formatters(),
    install(translator) {
      const before = target.locale();
      detach();
      target = translator;
      detach = target.onChange((locale) => listeners.forEach((listener) => listener(locale)));
      if (translator.locale() !== before) listeners.forEach((listener) => listener(translator.locale()));
    },
  };
}
