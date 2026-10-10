// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { exportTitleText } from "./export-title";
describe("exportTitleText", () => {
  it("names the video with the song's title, tempo and key", () => {
    expect(exportTitleText({ title: "Midnight Coast", tempo: 124, key: { tonic: 9, scale: "minor" } }, "Untitled")).toEqual({
      text: "Midnight Coast",
      detail: "124 BPM · a minor",
      fileStem: "midnight-coast",
    });
  });
  it("an older text without a title line gets the catalog's Untitled", () => {
    expect(exportTitleText({ title: null, tempo: null, key: null }, "Sem título")).toEqual({
      text: "Sem título",
      detail: "132 BPM · c minor",
      fileStem: "untzel",
    });
  });
});
