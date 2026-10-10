// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The one order of release paths (archive entries, manifest files): code-unit order, never
// the locale's, so every machine sorts the same way.

export function compareByPath(left: { readonly path: string }, right: { readonly path: string }): number {
  if (left.path < right.path) return -1;
  return left.path > right.path ? 1 : 0;
}
