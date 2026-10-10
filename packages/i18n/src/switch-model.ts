// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the language switch shows, without DOM: the app builds buttons from it, the docs
// generator renders the same model as a pair of links.
import { ENDONYMS, SWITCH_ORDER, type Locale } from "./locales";

export interface SwitchItem {
  readonly locale: Locale;
  /** The endonym, shown in its own language. */
  readonly label: string;
  readonly lang: Locale;
  readonly hreflang: Locale;
  readonly current: boolean;
  readonly href: string | null;
}

export function switchModel(current: Locale, hrefFor?: (locale: Locale) => string): readonly SwitchItem[] {
  return SWITCH_ORDER.map((locale) => ({
    locale,
    label: ENDONYMS[locale],
    lang: locale,
    hreflang: locale,
    current: locale === current,
    href: hrefFor === undefined ? null : hrefFor(locale),
  }));
}

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

export interface SwitchLabels {
  /** Accessible name of the group ("Language", "Idioma"). */
  readonly group: string;
}

/** Static markup: one link per locale, the current one marked with aria-current. */
export function renderSwitchHtml(model: readonly SwitchItem[], labels: SwitchLabels): string {
  const items = model
    .map((item) => {
      const current = item.current ? ' aria-current="true"' : "";
      const href = escape(item.href ?? "#");
      return `<a class="untzel-lang__item" href="${href}" lang="${item.lang}" hreflang="${item.hreflang}" data-locale-link="${item.locale}"${current}>${escape(item.label)}</a>`;
    })
    .join("");
  return `<nav class="untzel-lang" aria-label="${escape(labels.group)}">${items}</nav>`;
}
