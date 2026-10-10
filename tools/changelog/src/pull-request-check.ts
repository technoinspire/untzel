// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Does a pull request owe the changelog an entry? It does when it changes what
// someone playing Untzel sees or hears: the app, its packages or the instruments. Tests,
// docs, tools and CI do not. The no-changelog label is the explicit way out.

export const ENTRIES_DIRECTORY = "changelog/entries/";
const PRODUCT_PATHS = [/^apps\/web\/(?:src|public|index\.html)/, /^packages\/(?:skins\/)?[^/]+\/src\//, /^instruments\//];
const NOT_PRODUCT = [/\.test\.tsx?$/, /\.browser\.tsx?$/, /(?:^|\/)tests?\//, /(?:^|\/)testing\//, /\.md$/];

export function touchesProduct(path: string): boolean {
  return PRODUCT_PATHS.some((pattern) => pattern.test(path)) && !NOT_PRODUCT.some((pattern) => pattern.test(path));
}

export function isEntryFile(path: string): boolean {
  return path.startsWith(ENTRIES_DIRECTORY) && path.endsWith(".json");
}

export interface PullRequestFiles {
  /** Paths the pull request changes (git diff --name-only base...HEAD). */
  readonly changed: readonly string[];
  /** Paths it adds (git diff --diff-filter=A --name-only base...HEAD). */
  readonly added: readonly string[];
  /** The pull request carries the no-changelog label. */
  readonly skip: boolean;
}

/** null when the pull request is fine, otherwise the reason it is not. */
export function missingEntry({ changed, added, skip }: PullRequestFiles): string | null {
  if (skip || added.some(isEntryFile)) return null;
  const product = changed.filter(touchesProduct);
  if (product.length === 0) return null;
  const sample = product.slice(0, 3).join(", ");
  return `this pull request changes the app (${sample}${product.length > 3 ? ", …" : ""}) and adds no file to ${ENTRIES_DIRECTORY}. Add one (see changelog/README.md) or label it no-changelog.`;
}
