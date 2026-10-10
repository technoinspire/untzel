// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { appVersion } from "./app-version";

describe("appVersion", () => {
  it("is the release's version when the release sets it", () => {
    expect(appVersion("0.1.0", "0.0.0")).toBe("0.1.0");
  });
  it("is the package's version in any other build", () => {
    expect(appVersion(undefined, "0.0.0")).toBe("0.0.0");
    expect(appVersion("", "0.0.0")).toBe("0.0.0");
  });
  it("refuses a version that is not stable SemVer, as the tag check does", () => {
    expect(() => appVersion("v0.1.0", "0.0.0")).toThrow("MAJOR.MINOR.PATCH");
    expect(() => appVersion("0.1.0-rc.1", "0.0.0")).toThrow("MAJOR.MINOR.PATCH");
  });
});
