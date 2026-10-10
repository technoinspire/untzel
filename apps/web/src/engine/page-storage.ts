// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The same three lines as main.ts's pageStorage, on purpose: a module imported by the
// initial JS and by the boot chunk would become a chunk of its own and one more
// modulepreload on the first screen. Part of the boot chunk.

/** window.localStorage throws in some privacy modes; null means "no saving on this device". */
export function pageStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
