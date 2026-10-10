// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The last session, in this browser only. Nothing here
// talks to the network; the page CSP is connect-src 'self'.
import type { SavedSession } from "@untzel/session";
import { MAX_SOURCE_LENGTH } from "@untzel/session/limits";

export const LOCAL_KEY = "untzel:last-session";
const FORMAT_VERSION = 1;

/** One warning per page load, however many saves fail. */
let warned = false;

export class LocalSessionStore {
  readonly #storage: Storage | null;

  /** `storage` is window.localStorage on the page (null when reading it throws), a fake in tests. */
  constructor(storage: Storage | null) {
    this.#storage = storage;
  }

  /** False on quota, security errors or without storage; the sound and the screen do not change. */
  save(source: string, now: Date): boolean {
    if (this.#storage === null) return this.#failed("no storage");
    try {
      const record = { v: FORMAT_VERSION, source, savedAt: now.toISOString() };
      this.#storage.setItem(LOCAL_KEY, JSON.stringify(record));
      return true;
    } catch (error) {
      return this.#failed(error instanceof Error ? error.name : "unknown");
    }
  }

  /** Null when nothing valid is stored; an invalid record is removed. */
  load(): SavedSession | null {
    if (this.#storage === null) return null;
    let raw: string | null;
    try {
      raw = this.#storage.getItem(LOCAL_KEY);
    } catch {
      return null;
    }
    if (raw === null) return null;
    const record = parse(raw);
    if (record === null) this.clear();
    return record;
  }

  clear(): void {
    try {
      this.#storage?.removeItem(LOCAL_KEY);
    } catch {
      // Storage that refuses even a removal has nothing to clear.
    }
  }

  #failed(reason: string): false {
    if (!warned) console.warn(`share: the session was not saved on this device (${reason})`);
    warned = true;
    return false;
  }
}

function parse(raw: string): SavedSession | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as { readonly v?: unknown; readonly source?: unknown; readonly savedAt?: unknown };
  if (record.v !== FORMAT_VERSION) return null;
  if (typeof record.source !== "string" || record.source.length > MAX_SOURCE_LENGTH) return null;
  if (typeof record.savedAt !== "string") return null;
  return { source: record.source, savedAt: record.savedAt };
}
