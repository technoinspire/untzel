// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { ATTRIBUTION } from "../frame/attribution";
import { shouldFocusRetry } from "./idle-screen";
describe("the waiting screen", () => {
  it("moves a lost focus to Retry when the load fails", () => {
    expect(shouldFocusRetry("loading", "load-failed", true)).toBe(true);
    expect(shouldFocusRetry("idle", "load-failed", true)).toBe(true);
  });
  it("leaves a focus that is not lost, and does it once per failure", () => {
    expect(shouldFocusRetry("loading", "load-failed", false)).toBe(false);
    expect(shouldFocusRetry("load-failed", "load-failed", true)).toBe(false);
    expect(shouldFocusRetry("loading", "running", true)).toBe(false);
  });
  it("keeps the copyright notice", () => {
    expect(ATTRIBUTION.copyright).toBe("Copyright (c) 2026 Techno Inspire");
  });
});
