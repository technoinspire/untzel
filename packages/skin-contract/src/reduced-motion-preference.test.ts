// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import {
  REDUCED_MOTION_KEY,
  effectiveReducedMotion,
  nextReducedMotionChoice,
  readReducedMotionChoice,
  writeReducedMotionChoice,
} from "./reduced-motion-preference";
describe("the reduced motion choice", () => {
  it("shows the system's value with nothing saved, and the saved choice over it", () => {
    expect(effectiveReducedMotion(null, true)).toBe(true);
    expect(effectiveReducedMotion(null, false)).toBe(false);
    expect(effectiveReducedMotion(false, true)).toBe(false);
    expect(effectiveReducedMotion(true, false)).toBe(true);
  });
  it("a tap with nothing saved saves the opposite of the system", () => {
    expect(nextReducedMotionChoice(null, true)).toBe(false);
    expect(nextReducedMotionChoice(null, false)).toBe(true);
  });
  it("a tap back to the system's value removes the choice", () => {
    expect(nextReducedMotionChoice(false, true)).toBeNull();
    expect(nextReducedMotionChoice(true, false)).toBeNull();
  });
  it("a choice equal to a system that changed since: a tap saves the opposite", () => {
    expect(nextReducedMotionChoice(true, true)).toBe(false);
    expect(nextReducedMotionChoice(false, false)).toBe(true);
  });
  it("reads and writes on and off, and removes", () => {
    const values = new Map<string, string>();
    const store = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key) };
    writeReducedMotionChoice(store, true);
    expect(values.get(REDUCED_MOTION_KEY)).toBe("on");
    expect(readReducedMotionChoice(store)).toBe(true);
    writeReducedMotionChoice(store, null);
    expect(readReducedMotionChoice(store)).toBeNull();
    expect(readReducedMotionChoice(null)).toBeNull();
  });
});
