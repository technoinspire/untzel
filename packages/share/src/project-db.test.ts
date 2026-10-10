// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The IndexedDB round trip runs in Chrome (apps/web/tests/skins/booth/parallel/library/projects.browser.ts); here,
// what a stored value must be to come back as a project, and the missing database.
import { describe, expect, it } from "vitest";
import { isProjectRecord, openProjectStore, withReadablePlayback } from "./project-db";

const record = { id: "p1", source: "kick x...", title: "Night Drive", createdAt: "2026-10-03T12:00:00.000Z", updatedAt: "2026-10-03T12:00:00.000Z", templateOrigin: null };

describe("isProjectRecord", () => {
  it("accepts a whole record, with or without a title", () => {
    expect(isProjectRecord(record)).toBe(true);
    expect(isProjectRecord({ ...record, title: null, templateOrigin: "house/sunday-piano" })).toBe(true);
  });
  it("skips anything else: a missing field, a wrong type, a text past the limit", () => {
    expect(isProjectRecord(null)).toBe(false);
    expect(isProjectRecord({ ...record, id: 1 })).toBe(false);
    expect(isProjectRecord({ ...record, updatedAt: undefined })).toBe(false);
    expect(isProjectRecord({ ...record, source: "x".repeat(65_537) })).toBe(false);
  });
});

describe("withReadablePlayback", () => {
  it("keeps a stored mode and range, and a record stored before them as it is", () => {
    const playback = { mode: "song", range: { startBar: 9, endBar: 28, cycle: false } } as const;
    expect(withReadablePlayback({ ...record, playback })).toEqual({ ...record, playback });
    expect(withReadablePlayback({ ...record, playback: { mode: "loop", range: null } })).toEqual({ ...record, playback: { mode: "loop", range: null } });
    expect(withReadablePlayback(record)).toBe(record);
  });
  it("drops a damaged playback and keeps the project", () => {
    for (const playback of [null, "song", { mode: "dance", range: null }, { mode: "song" }, { mode: "song", range: { startBar: 4, endBar: 2, cycle: true } }, { mode: "loop", range: { startBar: 0, endBar: 2, cycle: true } }, { mode: "loop", range: { startBar: 1, endBar: 2 } }]) {
      const damaged = { ...record, playback } as unknown as Parameters<typeof withReadablePlayback>[0];
      expect(isProjectRecord(damaged)).toBe(true);
      expect(withReadablePlayback(damaged)).toEqual(record);
    }
  });
});

describe("openProjectStore", () => {
  it("is null without IndexedDB, so the page keeps the session in memory", async () => {
    expect(await openProjectStore(null)).toBeNull();
  });
});
