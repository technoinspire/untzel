// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// "Continue where you left off": the last valid text, saved on this device 1 s after an
// edit. Playing a template, a link or a file without touching it saves nothing: a
// received song never overwrites the saved session until the first edit. After
// that first edit every valid change saves, an undo back to the starting text included.
import type { Session, SourceStore } from "@untzel/session";

export const AUTOSAVE_DELAY_MS = 1_000;

export interface Autosave {
  /** The starting text becomes this one; nothing saves until a valid text differs from it. */
  rebase(source: string): void;
  /** The edit still waiting for its timer saves now: called before the open project changes. */
  flush(): void;
  dispose(): void;
}

// Over 40 lines: the base, the dirty flag and the timer are state that subscribe, rebase, flush and dispose share.
export function createAutosave(options: {
  readonly base: string;
  readonly session: Pick<Session, "subscribe">;
  readonly store: Pick<SourceStore, "saveLocal">;
  /** window.setTimeout on the page; returns the cancel. */
  readonly setTimer: (run: () => void, ms: number) => () => void;
}): Autosave {
  let base = options.base;
  /** True from the first valid edit away from the base until the next rebase. */
  let dirty = false;
  let cancel: (() => void) | null = null;
  const clear = (): void => {
    cancel?.();
    cancel = null;
  };
  /** The text waiting for its timer, or the one saved last: the view also changes with the playhead. */
  let latest: string | null = null;
  const save = (source: string): void => {
    clear();
    options.store.saveLocal(source);
  };
  const unsubscribe = options.session.subscribe((view) => {
    if (!view.valid || view.source === latest) return;
    if (!dirty && view.source === base) return;
    dirty = true;
    const source = view.source;
    latest = source;
    clear();
    cancel = options.setTimer(() => save(source), AUTOSAVE_DELAY_MS);
  });
  return {
    rebase(source) {
      base = source;
      dirty = false;
      latest = null;
      clear();
    },
    flush() {
      if (cancel !== null && latest !== null) save(latest);
    },
    dispose() {
      clear();
      unsubscribe();
    },
  };
}
