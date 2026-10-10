// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { ProjectLibrary, byRecentEdit, type ProjectRecord } from "./projects";
import { MemoryProjectStore as MemoryStore } from "./testing";


function setup() {
  const store = new MemoryStore();
  let clock = 0;
  let ids = 0;
  const library = new ProjectLibrary({
    store,
    now: () => new Date(Date.UTC(2026, 9, 3, 12, 0, clock++)),
    newId: () => `p${++ids}`,
    titleOf: (source) => /^title "(.*)"$/m.exec(source)?.[1] ?? null,
    withTitle: (source, title) => (/^title /m.test(source) ? source.replace(/^title ".*"$/m, `title "${title}"`) : `title "${title}"\n${source}`),
  });
  return { store, library };
}

describe("ProjectLibrary", () => {
  it("creates with the title read from the text, and lists the most recent first", async () => {
    const { library } = setup();
    const first = await library.create('title "Night Drive"\nkick x...', "house/sunday-piano");
    const second = await library.create("kick x...", null);
    expect(first).toMatchObject({ id: "p1", title: "Night Drive", templateOrigin: "house/sunday-piano" });
    expect(second.title).toBeNull();
    expect((await library.list()).map((record) => record.id)).toEqual(["p2", "p1"]);
    await library.save("p1", 'title "Night Drive"\nkick x.x.');
    expect((await library.list()).map((record) => record.id)).toEqual(["p1", "p2"]);
  });
  it("saving refreshes the title cache from the text, never from elsewhere", async () => {
    const { library } = setup();
    await library.create('title "A"\nkick x...', null);
    const saved = await library.save("p1", 'title "B"\nkick x...');
    expect(saved.title).toBe("B");
    expect(saved.createdAt < saved.updatedAt).toBe(true);
  });
  it("renames by editing the stored text", async () => {
    const { library, store } = setup();
    await library.create('title "A"\nkick x...', null);
    expect((await library.rename("p1", "Midnight Coast"))?.title).toBe("Midnight Coast");
    expect(store.records.get("p1")?.source).toBe('title "Midnight Coast"\nkick x...');
    expect(await library.rename("missing", "X")).toBeNull();
  });
  it("duplicates into a new project with the copy's title", async () => {
    const { library } = setup();
    const copy = await library.duplicate('title "A"\nkick x...', "A (copy)", null);
    expect(copy).toMatchObject({ id: "p1", title: "A (copy)" });
  });
  it("deletes at once and restores for Undo", async () => {
    const { library } = setup();
    await library.create('title "A"\nkick x...', null);
    const removed = await library.remove("p1");
    expect(await library.list()).toEqual([]);
    if (removed === null) throw new Error("not removed");
    await library.restore(removed);
    expect((await library.list()).map((record) => record.title)).toEqual(["A"]);
    expect(await library.remove("missing")).toBeNull();
  });
  it("keeps the mode and play range beside the text, and a save without them keeps the stored ones", async () => {
    const { library, store } = setup();
    const playback = { mode: "song", range: { startBar: 9, endBar: 28, cycle: false } } as const;
    await library.create("kick x...", null, playback);
    expect(store.records.get("p1")?.playback).toEqual(playback);
    await library.save("p1", "kick x.x.");
    expect(store.records.get("p1")).toMatchObject({ source: "kick x.x.", playback });
    const looped = { mode: "loop", range: null } as const;
    await library.save("p1", "kick xx..", looped);
    expect(store.records.get("p1")?.playback).toEqual(looped);
  });
  it("changing only the playback keeps the text and the list's order", async () => {
    const { library, store } = setup();
    await library.create("kick x...", null);
    const before = store.records.get("p1");
    const playback = { mode: "loop", range: { startBar: 2, endBar: 3, cycle: true } } as const;
    expect(await library.setPlayback("p1", playback)).toEqual({ ...before, playback });
    expect(store.records.get("p1")?.updatedAt).toBe(before?.updatedAt);
    expect(await library.setPlayback("missing", playback)).toBeNull();
  });
  it("a project stored before the playback travelled saves and opens without one", async () => {
    const { library, store } = setup();
    const legacy: ProjectRecord = { id: "old", source: "kick x...", title: null, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", templateOrigin: null };
    await store.put(legacy);
    expect(await library.get("old")).toEqual(legacy);
    expect("playback" in (await library.save("old", "kick x.x."))).toBe(false);
  });
  it("duplicates with the playback of the original", async () => {
    const { library } = setup();
    const playback = { mode: "song", range: null } as const;
    expect((await library.duplicate("kick x...", "A (copy)", null, playback)).playback).toEqual(playback);
  });
  it("byRecentEdit orders by the last edit", () => {
    const record = (id: string, updatedAt: string): ProjectRecord => ({ id, source: "", title: null, createdAt: updatedAt, updatedAt, templateOrigin: null });
    expect(byRecentEdit([record("a", "2026-10-01"), record("b", "2026-10-03"), record("c", "2026-10-02")]).map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  });
});
