// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { COLLAPSED_STORAGE_KEY, collapseToggleLabel, readCollapsed, writeCollapsed, type PreferenceStore } from "./collapse";

function memoryStore(): PreferenceStore & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

const broken: PreferenceStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("collapsed preference", () => {
  it("starts with the controls shown", () => {
    expect(readCollapsed(memoryStore())).toBe(false);
    expect(readCollapsed(null)).toBe(false);
  });

  it("survives a reload through the store", () => {
    const store = memoryStore();
    writeCollapsed(store, true);
    expect(store.values.get(COLLAPSED_STORAGE_KEY)).toBe("true");
    expect(readCollapsed(store)).toBe(true);
    writeCollapsed(store, false);
    expect(readCollapsed(store)).toBe(false);
  });

  it("reads anything but \"true\" as shown", () => {
    const store = memoryStore();
    store.setItem(COLLAPSED_STORAGE_KEY, "yes");
    expect(readCollapsed(store)).toBe(false);
  });

  it("a blocked or full storage never throws", () => {
    expect(readCollapsed(broken)).toBe(false);
    expect(() => writeCollapsed(broken, true)).not.toThrow();
    expect(() => writeCollapsed(null, true)).not.toThrow();
  });

  it("the toggle names what pressing it does", () => {
    expect(collapseToggleLabel(false)).toBe("Hide controls");
    expect(collapseToggleLabel(true)).toBe("Show controls");
  });
});
