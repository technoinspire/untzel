// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { TEMPLATE_CHOICE_KEY, TemplateChoiceStore } from "./template-choice-store";

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

describe("TemplateChoiceStore", () => {
  it("gives back the template and the style tab it saved", () => {
    const storage = memoryStorage();
    new TemplateChoiceStore(storage).save({ template: "house/disco-lights", openStyle: "psytrance" });
    expect(new TemplateChoiceStore(storage).load()).toEqual({ template: "house/disco-lights", openStyle: "psytrance" });
  });

  it("is null for a record it cannot read, and never throws", () => {
    const storage = memoryStorage();
    expect(new TemplateChoiceStore(storage).load()).toBeNull();
    storage.setItem(TEMPLATE_CHOICE_KEY, "{");
    expect(new TemplateChoiceStore(storage).load()).toBeNull();
    storage.setItem(TEMPLATE_CHOICE_KEY, JSON.stringify({ v: 2, template: "x" }));
    expect(new TemplateChoiceStore(storage).load()).toBeNull();
    storage.setItem(TEMPLATE_CHOICE_KEY, JSON.stringify({ v: 1, template: "x", openStyle: 3 }));
    expect(new TemplateChoiceStore(storage).load()).toEqual({ template: "x", openStyle: null });
    const refusing = { ...memoryStorage(), setItem: () => { throw new Error("QuotaExceededError"); }, getItem: () => { throw new Error("SecurityError"); } };
    expect(() => new TemplateChoiceStore(refusing).save({ template: "x", openStyle: null })).not.toThrow();
    expect(new TemplateChoiceStore(refusing).load()).toBeNull();
    expect(new TemplateChoiceStore(null).load()).toBeNull();
  });
});
