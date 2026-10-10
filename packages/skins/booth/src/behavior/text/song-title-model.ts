// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The song title in the top bar. Pure presentation: what the
// button shows, what the field keeps while typing, what Enter or leaving does, and the
// titles a remix and a copy get. The 60-code-point rule is core's normalizeTitle.
import { TITLE_MAX_CODE_POINTS, normalizeTitle, titleLength, withPrefix, withSuffix } from "@untzel/core";
import { phrases, strings } from "../../copy/copy";
import { REMIX_PREFIXES } from "./remix-prefixes";
/** What the h1 shows: the title as a rename button, or the app's name with no project. */
export interface SongTitleLabel {
  readonly text: string;
  readonly isRenamable: boolean;
}
export function songTitleLabel(title: string | null): SongTitleLabel {
  return title === null ? { text: strings.brand, isRenamable: false } : { text: title, isRenamable: true };
}
/** While typing: past 60 code points the draft keeps the first 60 (never half an emoji). */
export function clampTitleDraft(draft: string): string {
  return titleLength(draft) <= TITLE_MAX_CODE_POINTS ? draft : [...draft].slice(0, TITLE_MAX_CODE_POINTS).join("");
}
/** What Enter, Done or leaving the field does. */
export type TitleCommit =
  | { readonly kind: "write"; readonly title: string }
  /** The same title: nothing is written. */
  | { readonly kind: "close" }
  /** Empty: the title before it stays, and the polite region says so. */
  | { readonly kind: "keep" };
export function commitTitleDraft(draft: string, previous: string): TitleCommit {
  const title = normalizeTitle(draft);
  if (title === "") return { kind: "keep" };
  return title === previous ? { kind: "close" } : { kind: "write", title };
}
/** The polite announcement after a commit; null when nothing changed. */
export function titleAnnouncement(commit: TitleCommit): string | null {
  if (commit.kind === "write") return phrases.renamed(commit.title);
  return commit.kind === "keep" ? strings.titleKept : null;
}
/**
 * "Remix of <title>", or "Remix of Untitled" for a received text without a title. A title
 * that already starts with the prefix of any shipped language keeps one prefix.
 */
export function remixTitle(received: string | null): string {
  return withPrefix(received ?? strings.untitled, strings.remixPrefix, REMIX_PREFIXES);
}
/** "<title> (copy)"; a copy of a copy stacks, as other editors do. */
export function copyTitle(title: string): string {
  return withSuffix(title, strings.copySuffix);
}
