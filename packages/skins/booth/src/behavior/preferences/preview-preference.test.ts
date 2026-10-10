// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import type { PreferenceStore } from "./collapse";
import { PREVIEW_SOUNDS_KEY, readPreviewSounds, writePreviewSounds } from "./preview-preference";

function mapStore(): PreferenceStore & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

describe("Preview sounds", () => {
  it("is on by default and remembers being turned off", () => {
    const store = mapStore();
    expect(readPreviewSounds(store)).toBe(true);
    writePreviewSounds(store, false);
    expect(store.map.get(PREVIEW_SOUNDS_KEY)).toBe("false");
    expect(readPreviewSounds(store)).toBe(false);
  });

  it("stays on, for this visit, when storage is blocked", () => {
    const blocked: PreferenceStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readPreviewSounds(blocked)).toBe(true);
    expect(() => writePreviewSounds(blocked, false)).not.toThrow();
    expect(readPreviewSounds(null)).toBe(true);
  });
});
