// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A tagged template that escapes every interpolated value; no template engine. Only
// SafeHtml passes through unescaped, and only the Markdown renderer (html: false) and
// this module create it.

export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

type Value = SafeHtml | string | number | null | undefined | false | readonly Value[];

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

function render(value: Value): string {
  if (value === null || value === undefined || value === false) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: readonly Value[]): SafeHtml {
  let out = strings[0] ?? "";
  values.forEach((value, index) => {
    out += render(value) + (strings[index + 1] ?? "");
  });
  return new SafeHtml(out);
}

/** Markup that is already safe: the output of markdown-it with html disabled. */
export function trusted(markup: string): SafeHtml {
  return new SafeHtml(markup);
}

/** Inverse of escapeHtml plus numeric entities, for reading generated text back in checks. */
export function unescapeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Text content of a fragment: tags removed, entities decoded. */
export function textOf(markup: string): string {
  return unescapeHtml(markup.replace(/<[^>]*>/g, ""));
}
