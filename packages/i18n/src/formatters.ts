// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Plurals, numbers, dates and lists through Intl, so no locale rule is written by hand.
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
  const number = (value: number, options?: Intl.NumberFormatOptions): string =>
    new Intl.NumberFormat(locale, options).format(value);
  return {
    plural(count, forms) {
      const category = plurals.select(count);
      const form = category === "one" ? forms.one : category === "many" ? (forms.many ?? forms.other) : forms.other;
      return form.replaceAll("#", number(count));
    },
    number,
    date: (value, options) => new Intl.DateTimeFormat(locale, options).format(value),
    list: (items) => lists.format(items),
  };
}
