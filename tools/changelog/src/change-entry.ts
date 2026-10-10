// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// One change as people who play Untzel read it: a file in changelog/entries,
// written in the pull request that makes the change. Title and body in English and
// Brazilian Portuguese; date and pull request come from Git unless the file sets them.

export const CHANGE_CATEGORIES = ["new", "improved", "fixed"] as const;
export type ChangeCategory = (typeof CHANGE_CATEGORIES)[number];
export const ENTRY_LOCALES = ["en", "pt-BR"] as const;
export type EntryLocale = (typeof ENTRY_LOCALES)[number];
export type LocalizedText = Readonly<Record<EntryLocale, string>>;

export interface ChangeEntry {
  readonly category: ChangeCategory;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  /** A path of the public docs (/docs, /docs/<page>, /docs/<page>/<section>). */
  readonly docs?: string;
  /** ISO day; when absent, the day the file reached main. */
  readonly date?: string;
  /** Pull requests; when absent, the one whose squash commit added the file. */
  readonly refs?: readonly number[];
}

const DOCS_PATH = /^\/docs(?:\/[a-z0-9-]+){0,2}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const TITLE_LIMIT = 80;
const BODY_LIMIT = 280;
// Untzel makes music of any style, and never promises a date it can't keep (the product's
// copy rule, changelog/README.md). Names of templates and sounds stay in the catalog, not here.
const FORBIDDEN_WORDS =
  /\b(?:techno|house|trance|psytrance|dubstep|drum and bass|em breve|coming soon)\b/i;
const KEYS = new Set(["category", "title", "body", "docs", "date", "refs"]);

export class EntryError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function localized(value: unknown, field: string, limit: number): LocalizedText {
  if (!isRecord(value)) throw new EntryError(`${field} must have en and pt-BR`);
  const text: Record<string, string> = {};
  for (const locale of ENTRY_LOCALES) {
    const item = value[locale];
    if (typeof item !== "string" || item.trim() === "") throw new EntryError(`${field}.${locale} is missing`);
    if (item.length > limit) throw new EntryError(`${field}.${locale} is longer than ${limit} characters`);
    if (FORBIDDEN_WORDS.test(item)) throw new EntryError(`${field}.${locale} names a genre or says "soon": ${item}`);
    text[locale] = item;
  }
  const extra = Object.keys(value).filter((key) => !(ENTRY_LOCALES as readonly string[]).includes(key));
  if (extra.length > 0) throw new EntryError(`${field} has unknown languages: ${extra.join(", ")}`);
  return text as LocalizedText;
}

/** Validates one parsed entry file; the message names the first problem. */
export function parseChangeEntry(raw: unknown): ChangeEntry {
  if (!isRecord(raw)) throw new EntryError("an entry is a JSON object");
  const unknown = Object.keys(raw).filter((key) => !KEYS.has(key));
  if (unknown.length > 0) throw new EntryError(`unknown fields: ${unknown.join(", ")}`);
  const category = raw.category;
  if (typeof category !== "string" || !(CHANGE_CATEGORIES as readonly string[]).includes(category)) {
    throw new EntryError(`category must be one of ${CHANGE_CATEGORIES.join(", ")}`);
  }
  const entry: { -readonly [K in keyof ChangeEntry]: ChangeEntry[K] } = {
    category: category as ChangeCategory,
    title: localized(raw.title, "title", TITLE_LIMIT),
    body: localized(raw.body, "body", BODY_LIMIT),
  };
  if (raw.docs !== undefined) {
    if (typeof raw.docs !== "string" || !DOCS_PATH.test(raw.docs)) throw new EntryError("docs must be a path like /docs/app/play-range");
    entry.docs = raw.docs;
  }
  if (raw.date !== undefined) {
    if (typeof raw.date !== "string" || !ISO_DAY.test(raw.date)) throw new EntryError("date must be YYYY-MM-DD");
    entry.date = raw.date;
  }
  if (raw.refs !== undefined) {
    if (!Array.isArray(raw.refs) || raw.refs.length === 0 || !raw.refs.every((ref) => Number.isInteger(ref) && ref > 0)) {
      throw new EntryError("refs must be pull request numbers");
    }
    entry.refs = raw.refs as number[];
  }
  return entry;
}
