// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it, vi } from "vitest";
import { encodeLink } from "./link";
import { LOCAL_KEY, LocalSessionStore } from "./local-store";
import { createSourceStore } from "./source-store";

class FakeStorage implements Storage {
  readonly #items = new Map<string, string>();
  failWith: string | null = null;
  get length(): number {
    return this.#items.size;
  }
  clear(): void {
    this.#items.clear();
  }
  getItem(key: string): string | null {
    return this.#items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#items.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.failWith !== null) throw new DOMException("refused", this.failWith);
    this.#items.set(key, value);
  }
}

const NOW = new Date("2026-10-03T12:00:00.000Z");

describe("LocalSessionStore", () => {
  it("saves and loads the last session", () => {
    const storage = new FakeStorage();
    const store = new LocalSessionStore(storage);
    expect(store.save("tempo 120\n", NOW)).toBe(true);
    expect(JSON.parse(storage.getItem(LOCAL_KEY) ?? "")).toEqual({ v: 1, source: "tempo 120\n", savedAt: NOW.toISOString() });
    expect(store.load()).toEqual({ source: "tempo 120\n", savedAt: NOW.toISOString() });
  });

  it("returns false on a quota error and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = new FakeStorage();
    storage.failWith = "QuotaExceededError";
    const store = new LocalSessionStore(storage);
    expect(store.save("a", NOW)).toBe(false);
    expect(store.save("b", NOW)).toBe(false);
    expect(new LocalSessionStore(null).save("c", NOW)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("drops an invalid record and reads nothing", () => {
    const storage = new FakeStorage();
    const store = new LocalSessionStore(storage);
    for (const raw of ["{", JSON.stringify({ v: 2, source: "a", savedAt: "x" }), JSON.stringify({ v: 1, source: "a".repeat(65_537), savedAt: "x" }), JSON.stringify({ v: 1, source: 3, savedAt: "x" }), "null"]) {
      storage.setItem(LOCAL_KEY, raw);
      expect(store.load()).toBeNull();
      expect(storage.getItem(LOCAL_KEY)).toBeNull();
    }
  });

  it("works without storage", () => {
    const store = new LocalSessionStore(null);
    expect(store.load()).toBeNull();
    store.clear();
  });
});

describe("createSourceStore", () => {
  it("delegates links to encodeLink and the local session to LocalSessionStore", async () => {
    const storage = new FakeStorage();
    const page = "http://localhost:5173/";
    const store = createSourceStore({ storage, pageUrl: page, now: () => NOW });
    const range = { startBar: 2, endBar: 3, cycle: false };
    expect(await store.link("tempo 120\n", "song", range)).toEqual(await encodeLink("tempo 120\n", page, "song", range));
    expect(store.saveLocal("tempo 120\n")).toBe(true);
    expect(store.loadLocal()).toEqual({ source: "tempo 120\n", savedAt: NOW.toISOString() });
  });
});
