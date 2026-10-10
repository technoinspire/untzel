// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ProjectRecord, ProjectStore } from "../projects";

/** The project library's storage in memory, in place of IndexedDB. */
export class MemoryProjectStore implements ProjectStore {
  readonly records = new Map<string, ProjectRecord>();
  async all(): Promise<readonly ProjectRecord[]> {
    return [...this.records.values()];
  }
  async get(id: string): Promise<ProjectRecord | null> {
    return this.records.get(id) ?? null;
  }
  async put(record: ProjectRecord): Promise<void> {
    this.records.set(record.id, record);
  }
  async remove(id: string): Promise<void> {
    this.records.delete(id);
  }
}
