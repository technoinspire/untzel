// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { isReducedMotionDocument, writeMotionAttribute } from "./motion-attribute";
function fakeDocument(): Document {
  return { documentElement: { dataset: {} as DOMStringMap } } as unknown as Document;
}
describe("the data-motion attribute", () => {
  it("writes reduced and reads it back", () => {
    const doc = fakeDocument();
    writeMotionAttribute(doc, true);
    expect(doc.documentElement.dataset["motion"]).toBe("reduced");
    expect(isReducedMotionDocument(doc)).toBe(true);
  });
  it("writes full for false", () => {
    const doc = fakeDocument();
    writeMotionAttribute(doc, false);
    expect(doc.documentElement.dataset["motion"]).toBe("full");
    expect(isReducedMotionDocument(doc)).toBe(false);
  });
  it("reads full without the attribute", () => {
    expect(isReducedMotionDocument(fakeDocument())).toBe(false);
  });
});
