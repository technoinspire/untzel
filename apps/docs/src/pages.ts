// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The pages of the public documentation, in menu order. The id is English and the same in
// every language; content/<id>.md is the English source and content/<id>.pt-BR.md its
// translation.

export const PAGE_IDS = [
  "start",
  "app",
  "language",
  "reference",
  "instruments",
  "cookbook",
  "ai",
  "developers",
  "status",
  "credits",
] as const;

export type PageId = (typeof PAGE_IDS)[number];

/** URL segment below a locale root: the start page is the root itself. */
export function pageSlug(id: PageId): string {
  return id === "start" ? "" : id;
}

export function isPageId(value: string): value is PageId {
  return (PAGE_IDS as readonly string[]).includes(value);
}
