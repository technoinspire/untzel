// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Plurals, numbers, dates and lists through Intl, so no locale rule is written by hand.
// Each formatter is built once per set of options: the controls format their labels on
// every frame of a playing song, and building an Intl.NumberFormat per call was a tenth
// of the main thread on a phone.
import type { Locale } from "./locales";

export interface PluralForms {
  readonly one: string;
  readonly other: string;
  readonly many?: string;
}

export interface Formatters {
  /** The form Intl.PluralRules picks for count; "#" in it becomes the formatted count. */
  plural(count: number, forms: PluralForms): string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  date(value: Date, options?: Intl.DateTimeFormatOptions): string;
  /** "a, b and c" in the locale's words. */
  list(items: readonly string[]): string;
}

export function createFormatters(locale: Locale): Formatters {
  const plurals = new Intl.PluralRules(locale);
  const lists = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  const numbers = new Map<string, Intl.NumberFormat>();
  const dates = new Map<string, Intl.DateTimeFormat>();
  const number = (value: number, options?: Intl.NumberFormatOptions): string => {
    const key = options === undefined ? "" : JSON.stringify(options);
    let format = numbers.get(key);
    if (format === undefined) {
      format = new Intl.NumberFormat(locale, options);
      numbers.set(key, format);
    }
    return format.format(value);
  };
  const date = (value: Date, options?: Intl.DateTimeFormatOptions): string => {
    const key = options === undefined ? "" : JSON.stringify(options);
    let format = dates.get(key);
    if (format === undefined) {
      format = new Intl.DateTimeFormat(locale, options);
      dates.set(key, format);
    }
    return format.format(value);
  };
  return {
    plural(count, forms) {
      const category = plurals.select(count);
      const form = category === "one" ? forms.one : category === "many" ? (forms.many ?? forms.other) : forms.other;
      return form.replaceAll("#", number(count));
    },
    number,
    date,
    list: (items) => lists.format(items),
  };
}
