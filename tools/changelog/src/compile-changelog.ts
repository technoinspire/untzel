// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The published changelog: every entry file of the commit, with its day and
// pull request filled in from Git, in reading order. The release copies it to
// app/changelog.json, which the official site reads; the format is the site's.
import type { ChangeEntry, ChangeCategory, LocalizedText } from "./change-entry";

/** Where Git says an entry file came from: the commit that added it to main. */
export interface EntryOrigin {
  /** ISO day of that commit. */
  readonly date: string;
  /** Its subject line; a squash merge ends with "(#123)". */
  readonly subject: string;
}

export interface SourcedEntry {
  /** Path of the file under changelog/entries, the tie-breaker of the order. */
  readonly path: string;
  readonly entry: ChangeEntry;
  /** null while the file is not committed yet (local builds). */
  readonly origin: EntryOrigin | null;
}

export interface PublishedEntry {
  readonly date: string;
  readonly category: ChangeCategory;
  readonly refs: readonly number[];
  readonly docs?: string;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
}

export interface PublishedChangelog {
  readonly schemaVersion: 1;
  readonly source: { readonly repository: string; readonly throughPullRequest: number };
  readonly entries: readonly PublishedEntry[];
}

const SQUASH_SUFFIX = /\(#(\d+)\)\s*$/;

export function pullRequestOf(subject: string): number | null {
  const match = SQUASH_SUFFIX.exec(subject);
  return match ? Number(match[1]) : null;
}

function publish({ entry, origin }: SourcedEntry, today: string): PublishedEntry {
  const fromGit = origin ? pullRequestOf(origin.subject) : null;
  const refs = entry.refs ?? (fromGit === null ? [] : [fromGit]);
  return {
    date: entry.date ?? origin?.date ?? today,
    category: entry.category,
    refs,
    ...(entry.docs === undefined ? {} : { docs: entry.docs }),
    title: entry.title,
    body: entry.body,
  };
}

/** Oldest day first; within a day, by file path. The site reads a day backwards. */
export function compileChangelog(
  entries: readonly SourcedEntry[],
  repository: string,
  today: string,
): PublishedChangelog {
  const ordered = [...entries]
    .map((sourced) => ({ path: sourced.path, published: publish(sourced, today) }))
    .sort((a, b) => a.published.date.localeCompare(b.published.date) || a.path.localeCompare(b.path))
    .map(({ published }) => published);
  const refs = ordered.flatMap((entry) => entry.refs);
  return {
    schemaVersion: 1,
    source: { repository, throughPullRequest: refs.length === 0 ? 0 : Math.max(...refs) },
    entries: ordered,
  };
}

export function serializeChangelog(changelog: PublishedChangelog): string {
  return `${JSON.stringify(changelog, null, 2)}\n`;
}
