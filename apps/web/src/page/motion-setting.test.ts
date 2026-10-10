// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { createMotionSetting, type SystemMotion } from "./motion-setting";

function fakeDocument() {
  return { documentElement: { dataset: {} as DOMStringMap } } as unknown as Document;
}
function fakeSystem(matches: boolean) {
  const listeners: (() => void)[] = [];
  const system: SystemMotion & { matches: boolean; change(next: boolean): void } = {
    matches,
    addEventListener: (_type, listener) => void listeners.push(listener),
    change(next) {
      this.matches = next;
      for (const listener of listeners) listener();
    },
  };
  return system;
}
function memoryStore() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key), values };
}

describe("createMotionSetting", () => {
  it("publishes the system's value before anything paints", () => {
    const doc = fakeDocument();
    const setting = createMotionSetting({ doc, store: null, system: fakeSystem(true), isForced: false });
    expect(doc.documentElement.dataset["motion"]).toBe("reduced");
    expect([setting.isReduced(), setting.isFollowingSystem()]).toEqual([true, true]);
  });
  it("a toggle saves the opposite, tells once, and a second toggle follows the system again", () => {
    const doc = fakeDocument();
    const store = memoryStore();
    const setting = createMotionSetting({ doc, store, system: fakeSystem(false), isForced: false });
    let told = 0;
    setting.onChange(() => (told += 1));
    setting.toggle();
    expect([setting.isReduced(), setting.isFollowingSystem(), told, doc.documentElement.dataset["motion"]]).toEqual([true, false, 1, "reduced"]);
    expect(store.values.get("untzel.motion.reduced")).toBe("on");
    setting.toggle();
    expect([setting.isReduced(), setting.isFollowingSystem(), told]).toEqual([false, true, 2]);
    expect(store.values.has("untzel.motion.reduced")).toBe(false);
  });
  it("the system's change counts only with nothing saved", () => {
    const system = fakeSystem(false);
    const setting = createMotionSetting({ doc: fakeDocument(), store: memoryStore(), system, isForced: false });
    let told = 0;
    setting.onChange(() => (told += 1));
    system.change(true);
    expect([setting.isReduced(), told]).toEqual([true, 1]);
    setting.toggle();
    system.change(false);
    expect(setting.isReduced()).toBe(false);
    system.change(true);
    expect([setting.isReduced(), setting.isFollowingSystem()]).toEqual([false, false]);
  });
  it("the page flag forces reduced", () => {
    const doc = fakeDocument();
    expect(createMotionSetting({ doc, store: null, system: fakeSystem(false), isForced: true }).isReduced()).toBe(true);
    expect(doc.documentElement.dataset["motion"]).toBe("reduced");
  });
});
