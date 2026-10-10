// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { MemoryProjectStore as MemoryStore } from "@untzel/session/testing";
import { describe, expect, it } from "vitest";
import { createProjectLibrary, migrateLastSession, withTitle } from "./project-library";


function legacy(source: string | null) {
  let cleared = false;
  return {
    load: () => (source === null ? null : { source, savedAt: "2026-10-02T10:00:00.000Z" }),
    clear: () => void (cleared = true),
    wasCleared: () => cleared,
  };
}

describe("migrateLastSession", () => {
  it("moves the old saved session into the first project, once", async () => {
    const store = new MemoryStore();
    const library = createProjectLibrary(store);
    const old = legacy('title "Night"\nkick x...');
    await migrateLastSession(library, old);
    expect((await library.list()).map((record) => [record.title, record.source])).toEqual([["Night", 'title "Night"\nkick x...']]);
    expect(old.wasCleared()).toBe(true);
  });
  it("never adds it to a library that already has projects", async () => {
    const store = new MemoryStore();
    const library = createProjectLibrary(store);
    await library.create("kick x...", null);
    await migrateLastSession(library, legacy("hat ..x."));
    expect(await library.list()).toHaveLength(1);
  });
  it("does nothing without an old session", async () => {
    const library = createProjectLibrary(new MemoryStore());
    await migrateLastSession(library, legacy(null));
    expect(await library.list()).toEqual([]);
  });
});

describe("withTitle", () => {
  it("writes the title line, and refuses an empty title", () => {
    expect(withTitle("kick x...", "Night Drive")).toBe('title "Night Drive"\nkick x...');
    expect(withTitle("kick x...", "  ")).toBeNull();
  });
});
