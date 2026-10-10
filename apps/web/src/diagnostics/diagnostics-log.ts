// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { fnv1a32 } from "@untzel/core";
import type { DiagnosticsLog } from "@untzel/session";

/** console.error once per text: the same broken text typed again is not logged twice. */
export class ConsoleDiagnosticsLog implements DiagnosticsLog {
  readonly #seen = new Set<number>();

  internalError(source: string, error: unknown): void {
    const key = fnv1a32(source);
    if (this.#seen.has(key)) return;
    this.#seen.add(key);
    console.error("Untzel internal error while analyzing the text:", error);
  }
}
