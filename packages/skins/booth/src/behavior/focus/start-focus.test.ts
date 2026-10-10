// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { focusAfterStart } from "./start-focus";

describe("focusAfterStart", () => {
  it("opens the empty project on Add track, wherever the focus was", () => {
    expect(focusAfterStart(true, true)).toBe("add-track");
    expect(focusAfterStart(true, false)).toBe("add-track");
  });
  it("gives Play the focus the waiting screen lost", () => {
    expect(focusAfterStart(false, true)).toBe("play");
  });
  it("leaves a focus that was not lost where it is", () => {
    expect(focusAfterStart(false, false)).toBeNull();
  });
});
