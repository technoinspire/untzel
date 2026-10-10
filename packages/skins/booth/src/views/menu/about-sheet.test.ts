// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { aboutLines } from "./about-sheet";
describe("aboutLines", () => {
  it("carries the version, the licence and the attribution ATTRIBUTION.md asks of an About notice", () => {
    const lines = aboutLines({ version: "0.4.0" });
    expect(lines[0]).toBe("Version 0.4.0");
    expect(lines[1]).toContain("CPAL-1.0");
    expect(lines).toContain("Powered by Untzel · Techno Inspire");
    expect(lines).toContain("Copyright (c) 2026 Techno Inspire");
  });
});
