// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project library: many songs on this device, no account and no
// server. The text is the only source of truth (rule 5): a project's title is read from
// its `title` line when it is saved, a cache for the list, never a second copy to keep in
// step. Pure use cases over a ProjectStore port; the page binds IndexedDB to it.
import type { PlaybackMode, PlayRange } from "@untzel/transport";
/** The mode and play range a project was left in: beside the text, never in it. */
export interface ProjectPlayback {
  readonly mode: PlaybackMode;
  /** The range of `mode`; null without one. */
  readonly range: PlayRange | null;
}
/** One stored song. Dates are ISO 8601. */
export interface ProjectRecord {
  readonly id: string;
  /** The Untzel text, at most MAX_SOURCE_LENGTH. */
  readonly source: string;
  /** Read from the text's title line at the last save; null when it has none. */
  readonly title: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** The template it started from, for the record; null for a blank, a link or a file. */
  readonly templateOrigin: string | null;
  /** Absent in projects stored before the range travelled: they open as before. */
  readonly playback?: ProjectPlayback;
}
/** Where projects live. Every method rejects when storage refuses (private mode, full disk). */
export interface ProjectStore {
  all(): Promise<readonly ProjectRecord[]>;
  get(id: string): Promise<ProjectRecord | null>;
  put(record: ProjectRecord): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface ProjectLibraryDependencies {
  readonly store: ProjectStore;
  readonly now: () => Date;
  readonly newId: () => string;
  /** The text's title (language's titleOf). */
  readonly titleOf: (source: string) => string | null;
  /** The text with this title (language's setTitleEdit); null when it cannot be written. */
  readonly withTitle: (source: string, title: string) => string | null;
}
/** Most recent first: the order of the list and of "Continue". */
export function byRecentEdit(records: readonly ProjectRecord[]): readonly ProjectRecord[] {
  return [...records].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}
export class ProjectLibrary {
  readonly #dependencies: ProjectLibraryDependencies;
  constructor(dependencies: ProjectLibraryDependencies) {
    this.#dependencies = dependencies;
  }
  async list(): Promise<readonly ProjectRecord[]> {
    return byRecentEdit(await this.#dependencies.store.all());
  }
  get(id: string): Promise<ProjectRecord | null> {
    return this.#dependencies.store.get(id);
  }
  async create(source: string, templateOrigin: string | null, playback: ProjectPlayback | null = null): Promise<ProjectRecord> {
    const at = this.#dependencies.now().toISOString();
    const record = withPlayback({ id: this.#dependencies.newId(), source, title: this.#dependencies.titleOf(source), createdAt: at, updatedAt: at, templateOrigin }, playback);
    await this.#dependencies.store.put(record);
    return record;
  }
  /** The open project's text after an edit; an id no longer stored is created again. A null playback keeps the stored one. */
  async save(id: string, source: string, playback: ProjectPlayback | null = null): Promise<ProjectRecord> {
    const found = await this.#dependencies.store.get(id);
    const at = this.#dependencies.now().toISOString();
    const base = found ?? { id, createdAt: at, templateOrigin: null };
    const record = withPlayback({ ...base, source, title: this.#dependencies.titleOf(source), updatedAt: at }, playback);
    await this.#dependencies.store.put(record);
    return record;
  }
  /** Only the mode and range changed: the text and `updatedAt` stay, so the list keeps its order. Null when unknown. */
  async setPlayback(id: string, playback: ProjectPlayback): Promise<ProjectRecord | null> {
    const found = await this.#dependencies.store.get(id);
    if (found === null) return null;
    const record = withPlayback(found, playback);
    await this.#dependencies.store.put(record);
    return record;
  }
  /** A stored project's title, by the same minimal edit of its text; null when unknown or refused. */
  async rename(id: string, title: string): Promise<ProjectRecord | null> {
    const found = await this.#dependencies.store.get(id);
    const source = found === null ? null : this.#dependencies.withTitle(found.source, title);
    return found === null || source === null ? null : this.save(id, source);
  }
  /** A new project from a text, with its title line set to `title` ("Midnight Coast (copy)"). */
  async duplicate(source: string, title: string, templateOrigin: string | null, playback: ProjectPlayback | null = null): Promise<ProjectRecord> {
    return this.create(this.#dependencies.withTitle(source, title) ?? source, templateOrigin, playback);
  }
  /** Gone at once; the record comes back for Undo. */
  async remove(id: string): Promise<ProjectRecord | null> {
    const found = await this.#dependencies.store.get(id);
    if (found !== null) await this.#dependencies.store.remove(id);
    return found;
  }
  restore(record: ProjectRecord): Promise<void> {
    return this.#dependencies.store.put(record);
  }
}
/** The record with this playback; null leaves the record's own (or none). */
function withPlayback(record: ProjectRecord, playback: ProjectPlayback | null): ProjectRecord {
  return playback === null ? record : { ...record, playback };
}
