// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project library's storage: IndexedDB in this browser only, through
// a small wrapper with no dependency. Nothing here talks to the network. A record that
// does not read back as a project (an older or damaged one) is skipped, never trusted; a
// damaged `playback` is dropped and the project opens as it did before it.
import type { ProjectPlayback, ProjectRecord, ProjectStore } from "@untzel/session/projects";
import { MAX_SOURCE_LENGTH } from "@untzel/session/limits";
export const PROJECTS_DATABASE = "untzel-projects";
const VERSION = 1;
const STORE = "projects";
/** The store, or null where IndexedDB is missing or refuses to open (some private modes). */
export async function openProjectStore(factory: IDBFactory | null): Promise<ProjectStore | null> {
  if (factory === null) return null;
  try {
    const opening = factory.open(PROJECTS_DATABASE, VERSION);
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE)) opening.result.createObjectStore(STORE, { keyPath: "id" });
    };
    const database = await request(opening);
    return new IndexedDbProjectStore(database);
  } catch {
    return null;
  }
}
class IndexedDbProjectStore implements ProjectStore {
  readonly #database: IDBDatabase;
  constructor(database: IDBDatabase) {
    this.#database = database;
  }
  async all(): Promise<readonly ProjectRecord[]> {
    const values = await request(this.#store("readonly").getAll());
    return (values as unknown[]).flatMap((value) => (isProjectRecord(value) ? [withReadablePlayback(value)] : []));
  }
  async get(id: string): Promise<ProjectRecord | null> {
    const value: unknown = await request(this.#store("readonly").get(id));
    return isProjectRecord(value) ? withReadablePlayback(value) : null;
  }
  async put(record: ProjectRecord): Promise<void> {
    await request(this.#store("readwrite").put(record));
  }
  async remove(id: string): Promise<void> {
    await request(this.#store("readwrite").delete(id));
  }
  #store(mode: IDBTransactionMode): IDBObjectStore {
    return this.#database.transaction(STORE, mode).objectStore(STORE);
  }
}
/** An IDBRequest as a promise. */
function request<T>(pending: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pending.onsuccess = () => resolve(pending.result);
    pending.onerror = () => reject(pending.error ?? new Error("indexedDB request failed"));
  });
}
/** What a stored value must be to come back as a project. */
export function isProjectRecord(value: unknown): value is ProjectRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const isText = (key: string): boolean => typeof record[key] === "string";
  const isOptionalText = (key: string): boolean => record[key] === null || typeof record[key] === "string";
  return (
    isText("id") &&
    isText("source") &&
    (record["source"] as string).length <= MAX_SOURCE_LENGTH &&
    isOptionalText("title") &&
    isText("createdAt") &&
    isText("updatedAt") &&
    isOptionalText("templateOrigin")
  );
}

/** The record, without its `playback` when that does not read back as one. */
export function withReadablePlayback(record: ProjectRecord): ProjectRecord {
  if (record.playback === undefined || isProjectPlayback(record.playback)) return record;
  const { playback: _dropped, ...rest } = record;
  return rest;
}

function isProjectPlayback(value: unknown): value is ProjectPlayback {
  if (typeof value !== "object" || value === null) return false;
  const playback = value as Record<string, unknown>;
  return (playback["mode"] === "loop" || playback["mode"] === "song") && (playback["range"] === null || isRange(playback["range"]));
}

function isRange(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const range = value as Record<string, unknown>;
  const { startBar, endBar } = range;
  return Number.isInteger(startBar) && Number.isInteger(endBar) && (startBar as number) >= 1 && (endBar as number) >= (startBar as number) && typeof range["cycle"] === "boolean";
}
