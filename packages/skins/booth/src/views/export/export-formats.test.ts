// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ExportView } from "@untzel/presentation/view-model";
import { formatOptionState } from "./export-formats";

const state = {
  format: "video",
  durations: { story: "0:15 + 2 s", video: "0:29 + 2 s", audio: "0:29 · WAV" },
  isVideoUnavailable: false,
} as unknown as ExportView;

describe("formatOptionState", () => {
  it("presses the chosen format and shows each format's own length", () => {
    expect(formatOptionState("video", state)).toEqual({ isPressed: true, isDisabled: false, detail: "0:29 + 2 s" });
    expect(formatOptionState("story", state)).toEqual({ isPressed: false, isDisabled: false, detail: "0:15 + 2 s" });
  });

  it("leaves only Audio acting when the browser has no video codec", () => {
    const noVideo = { ...state, isVideoUnavailable: true } as ExportView;
    expect(formatOptionState("video", noVideo).isDisabled).toBe(true);
    expect(formatOptionState("audio", noVideo).isDisabled).toBe(false);
  });
});
