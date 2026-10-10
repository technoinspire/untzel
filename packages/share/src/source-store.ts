// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SourceStore } from "@untzel/session";
import { encodeLink } from "./link";
import { LocalSessionStore } from "./local-store";

/** The only implementation of SourceStore; created by the composition root alone. */
export function createSourceStore(options: {
  /** Null when window.localStorage throws. */
  readonly storage: Storage | null;
  /** location.origin + location.pathname. */
  readonly pageUrl: string;
  readonly now: () => Date;
}): SourceStore {
  const local = new LocalSessionStore(options.storage);
  return {
    link: (source, mode, range) => encodeLink(source, options.pageUrl, mode, range),
    saveLocal: (source) => local.save(source, options.now()),
    loadLocal: () => local.load(),
  };
}
