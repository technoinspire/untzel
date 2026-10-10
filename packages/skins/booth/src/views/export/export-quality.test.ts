// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { qualityDetail } from "./export-quality";

describe("qualityDetail", () => {
  it("names the resolution and, once the device is probed, the time to render", () => {
    expect(qualityDetail({ quality: "4k", resolution: "3840 × 2160", estimate: "about 31 s to render" })).toBe("3840 × 2160 · about 31 s to render");
  });

  it("promises no number before the probe", () => {
    expect(qualityDetail({ quality: "hd", resolution: "1080 × 1920", estimate: null })).toBe("1080 × 1920");
  });
});
