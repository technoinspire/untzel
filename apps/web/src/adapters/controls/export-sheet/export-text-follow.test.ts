// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Session } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { ExportTextFollow } from "./export-text-follow";

function fakeSession() {
  let hash: number | null = 1;
  const listeners = new Set<() => void>();
  const session = {
    state: () => ({ program: hash === null ? null : { sourceHash: hash } }),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as Session;
  const change = (next: number | null): void => {
    hash = next;
    for (const listener of listeners) listener();
  };
  return { session, change, listeners };
}

describe("ExportTextFollow", () => {
  it("calls once per text that differs from the one it follows; a rename keeps the hash", () => {
    const { session, change } = fakeSession();
    let others = 0;
    const follow = new ExportTextFollow(session, () => (others += 1));
    follow.follow();
    change(1);
    expect(others).toBe(0);
    change(2);
    change(2);
    expect(others).toBe(1);
  });
  it("follows the text of the moment again, with one subscription, until stopped", () => {
    const { session, change, listeners } = fakeSession();
    let others = 0;
    const follow = new ExportTextFollow(session, () => (others += 1));
    follow.follow();
    change(3);
    follow.follow();
    expect(listeners.size).toBe(1);
    follow.stop();
    change(4);
    expect(others).toBe(1);
    expect(listeners.size).toBe(0);
  });
});
