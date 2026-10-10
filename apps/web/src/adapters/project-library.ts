// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project library bound to this browser: IndexedDB through
// @untzel/share/projects, the title read and written by the language's own functions,
// and, once, the single saved session of before (localStorage) moved into the first
// project, so "Continue where you left off" is never lost.
import { setTitleEdit, titleOf } from "@untzel/language";
import { ProjectLibrary, type ProjectStore } from "@untzel/session/projects";
import { LocalSessionStore } from "@untzel/share/local-store";
import { openProjectStore } from "@untzel/share/projects";

/** The text with this title line, or null when the title is empty. */
export function withTitle(source: string, title: string): string | null {
  const edit = setTitleEdit(source, title);
  return edit.ok ? edit.source : null;
}

export function createProjectLibrary(store: ProjectStore): ProjectLibrary {
  return new ProjectLibrary({ store, now: () => new Date(), newId: () => crypto.randomUUID(), titleOf, withTitle });
}

/** The old single autosave becomes the first project when the library is still empty. */
export async function migrateLastSession(library: ProjectLibrary, legacy: Pick<LocalSessionStore, "load" | "clear">): Promise<void> {
  const saved = legacy.load();
  if (saved === null) return;
  if ((await library.list()).length === 0) await library.create(saved.source, null);
  legacy.clear();
}

/** Null where this browser refuses IndexedDB: the page then keeps the session in memory only. */
export async function openProjectLibrary(storage: Storage | null): Promise<ProjectLibrary | null> {
  const store = await openProjectStore(typeof indexedDB === "undefined" ? null : indexedDB);
  if (store === null) return null;
  const library = createProjectLibrary(store);
  try {
    await migrateLastSession(library, new LocalSessionStore(storage));
    void navigator.storage?.persist?.().catch(() => false);
  } catch (error) {
    console.warn("projects: the saved session was not moved into the library", error);
  }
  return library;
}
