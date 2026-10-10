// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { ChangeSet } from "@codemirror/state";

/** The smallest single replacement that turns `from` into `to` (common prefix and suffix kept). */
export function textDiff(from: string, to: string): ChangeSet {
  let start = 0;
  const shortest = Math.min(from.length, to.length);
  while (start < shortest && from.charCodeAt(start) === to.charCodeAt(start)) start += 1;
  let end = 0;
  while (
    end < shortest - start &&
    from.charCodeAt(from.length - 1 - end) === to.charCodeAt(to.length - 1 - end)
  ) {
    end += 1;
  }
  return ChangeSet.of({ from: start, to: from.length - end, insert: to.slice(start, to.length - end) }, from.length);
}

/**
 * Keeps the editor's document and the session's text together while the person types.
 * `base` is the session text the document was last in step with; `local` holds what the
 * person typed since. A session change that arrives during the typing pause (a tile or
 * slider on desktop) is rebased onto the typing instead of being dropped, and the
 * typing is never overwritten: both reach the session when the pause ends.
 */
export class SessionSync {
  #base: string;
  #local: ChangeSet;

  constructor(source: string) {
    this.#base = source;
    this.#local = ChangeSet.empty(source.length);
  }

  get hasLocalEdits(): boolean {
    return !this.#local.empty;
  }

  /** A transaction the person made on the document. */
  recordLocal(changes: ChangeSet): void {
    this.#local = this.#local.compose(changes);
  }

  /** The session's text changed: the changes to apply to the document, or null for none. */
  incoming(source: string): ChangeSet | null {
    if (source === this.#base) return null;
    const remote = textDiff(this.#base, source);
    const onDocument = this.#local.empty ? remote : remote.map(this.#local);
    this.#local = this.#local.map(remote, true);
    this.#base = source;
    return onDocument.empty ? null : onDocument;
  }

  /** The document went to the session: it is the new base, with nothing pending. */
  sent(source: string): void {
    this.#base = source;
    this.#local = ChangeSet.empty(source.length);
  }
}
