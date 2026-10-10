// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { LibraryMode } from "../../behavior/library/library-mode";

/** What a row does, the same in both modes of the sheet: listen, stop, add or use. */
export interface LibraryRowActions {
  readonly mode: LibraryMode;
  /** `pattern` null plays the manifest's preview (add) or keeps the track's pattern (replace). */
  preview(instrument: string, sound: string | null, pattern: string | null): void;
  stop(): void;
  /** Add the track, or use the sound for the track. */
  choose(instrument: string, sound: string | null, pattern: string | null): void;
}
