// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// One search index per locale: a row per page and per h2 or h3 section, with a short text.
import { textOf } from "../render/html";

/** t: title, p: path below the docs root (with the section anchor), s: text to match. */
export interface SearchEntry {
  readonly t: string;
  readonly p: string;
  readonly s: string;
}

const SECTION = /<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;
const SNIPPET_LENGTH = 240;

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function searchEntries(path: string, title: string, description: string, body: string): readonly SearchEntry[] {
  const entries: SearchEntry[] = [{ t: title, p: path, s: description }];
  const matches = [...body.matchAll(SECTION)];
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? body.length;
    const heading = squash(textOf(match[3] ?? ""));
    entries.push({ t: `${title} · ${heading}`, p: `${path}#${match[2] ?? ""}`, s: squash(textOf(body.slice(start, end))).slice(0, SNIPPET_LENGTH) });
  });
  return entries;
}

/** The meta description: the first paragraph, cut at a word boundary within 160 characters. */
export function descriptionOf(body: string): string {
  const paragraph = /<p>([\s\S]*?)<\/p>/.exec(body)?.[1] ?? "";
  const text = squash(textOf(paragraph));
  if (text.length <= 160) return text;
  const cut = text.slice(0, 159);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}
