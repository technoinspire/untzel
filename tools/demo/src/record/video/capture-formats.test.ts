// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { CAPTURE_FORMATS, captureFormat } from "./capture-formats";

describe("capture formats", () => {
  it("captures Story, Video and 4K at the export's sizes", () => {
    expect(CAPTURE_FORMATS.story.frame).toEqual({ width: 1080, height: 1920 });
    expect(CAPTURE_FORMATS.video.frame).toEqual({ width: 1920, height: 1080 });
    expect(CAPTURE_FORMATS["4k"].frame).toEqual({ width: 3840, height: 2160 });
    expect(CAPTURE_FORMATS["4k"].viewport).toEqual(CAPTURE_FORMATS.video.viewport);
  });
  it("knows a format by its name only", () => {
    expect(captureFormat("story")?.name).toBe("story");
    expect(captureFormat("gif")).toBeNull();
    expect(captureFormat("toString")).toBeNull();
  });
});
