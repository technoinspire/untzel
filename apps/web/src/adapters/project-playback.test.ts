// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it, vi } from "vitest";
import { ProjectPlaybackWriter } from "./project-playback";

const SONG = { mode: "song", range: { startBar: 9, endBar: 28, cycle: false } } as const;

function library() {
  const order: string[] = [];
  return {
    order,
    setPlayback: vi.fn(async (id: string) => {
      order.push(`playback ${id}`);
      return null;
    }),
  };
}

describe("ProjectPlaybackWriter", () => {
  it("writes a changed playback once, and nothing for the one stored", async () => {
    const writer = new ProjectPlaybackWriter();
    const store = library();
    writer.remember({ mode: "song", range: null });
    writer.write(store, "p1", { mode: "song", range: null }, Promise.resolve());
    writer.write(store, "p1", SONG, Promise.resolve());
    writer.write(store, "p1", SONG, Promise.resolve());
    await writer.writing;
    expect(store.setPlayback).toHaveBeenCalledTimes(1);
    expect(store.setPlayback).toHaveBeenCalledWith("p1", SONG);
  });

  it("waits for the text save in flight", async () => {
    const writer = new ProjectPlaybackWriter();
    const store = library();
    let finishSave = (): void => undefined;
    const saving = new Promise<void>((resolve) => (finishSave = resolve)).then(() => void store.order.push("text"));
    writer.write(store, "p1", SONG, saving);
    finishSave();
    await writer.writing;
    expect(store.order).toEqual(["text", "playback p1"]);
  });

  it("a refused write is reported and settles, so the next text save is not held", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const writer = new ProjectPlaybackWriter();
    writer.write({ setPlayback: () => Promise.reject(new Error("quota")) }, "p1", SONG, Promise.resolve());
    await expect(writer.writing).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
