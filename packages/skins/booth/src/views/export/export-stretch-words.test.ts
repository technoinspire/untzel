// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { capOf, clockLabel, exportCapNote, limitLabel } from "./export-stretch-words";
describe("export stretch words", () => {
  it("writes times as m:ss.s and caps as m:ss", () => {
    expect(clockLabel(7.25)).toBe("0:07.3");
    expect(clockLabel(59.96)).toBe("1:00.0");
    expect(clockLabel(261)).toBe("4:21.0");
    expect(limitLabel(60)).toBe("1:00");
    expect(limitLabel(261)).toBe("4:21");
  });
  it("names the cap by format and quality", () => {
    expect(capOf("story", "4k")).toBe("Story");
    expect(capOf("video", "hd")).toBe("Video");
    expect(capOf("video", "4k")).toBe("4K");
    expect(capOf("audio", "hd")).toBe("WAV");
    expect(exportCapNote("story", "hd", 60)).toBe("Story up to 1:00");
    expect(exportCapNote("video", "4k", 261)).toBe("4K up to 4:21");
  });
});
