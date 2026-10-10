// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { ATTRIBUTION } from "./attribution";

describe("ATTRIBUTION", () => {
  it("holds the values ATTRIBUTION.md requires", () => {
    expect(ATTRIBUTION.phrase).toBe("Powered by Untzel · Techno Inspire");
    expect(ATTRIBUTION.url).toBe("https://untzel.com");
    expect(ATTRIBUTION.copyright).toBe("Copyright (c) 2026 Techno Inspire");
  });

  it("draws the Untzel wordmark at its own proportions", () => {
    expect(ATTRIBUTION.logoAlt).toBe("Untzel");
    expect(ATTRIBUTION.logoWidth / ATTRIBUTION.logoHeight).toBeCloseTo(238 / 68);
  });
});
