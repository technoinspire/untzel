// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { PREVIEW_SOUNDS_KEY } from "./preview-preference";
import { createPreviewSoundsSetting } from "./preview-sounds-setting";
function memoryStore() {
  const values = new Map<string, string>();
  const writes: string[] = [];
  return {
    store: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => (writes.push(value), values.set(key, value)) },
    writes,
  };
}
describe("createPreviewSoundsSetting", () => {
  it("a new value writes and tells each listener once", () => {
    const { store, writes } = memoryStore();
    const setting = createPreviewSoundsSetting(store);
    let calls = 0;
    setting.onChange(() => (calls += 1));
    setting.set(false);
    expect(setting.isOn()).toBe(false);
    expect(writes).toEqual(["false"]);
    expect(calls).toBe(1);
  });
  it("the same value neither writes nor tells", () => {
    const { store, writes } = memoryStore();
    const setting = createPreviewSoundsSetting(store);
    let calls = 0;
    setting.onChange(() => (calls += 1));
    setting.set(true);
    expect(writes).toEqual([]);
    expect(calls).toBe(0);
  });
  it("reads the device once, and without storage keeps the value for the visit", () => {
    const { store } = memoryStore();
    store.setItem(PREVIEW_SOUNDS_KEY, "false");
    expect(createPreviewSoundsSetting(store).isOn()).toBe(false);
    const visit = createPreviewSoundsSetting(null);
    visit.set(false);
    expect(visit.isOn()).toBe(false);
  });
  it("a cancelled listener is told no more", () => {
    const setting = createPreviewSoundsSetting(null);
    let calls = 0;
    const cancel = setting.onChange(() => (calls += 1));
    cancel();
    setting.set(false);
    expect(calls).toBe(0);
  });
});
