// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { FPS, SAMPLES_PER_VIDEO_FRAME, TITLE_CARD_FRAMES, clockOf, frameOfBeat, frameOfSeconds, msOfFrame, secondsOfFrames } from "./frame-time";

describe("frame time", () => {
  it("ties a video frame to 1 600 samples of the take and to the virtual clock", () => {
    expect(SAMPLES_PER_VIDEO_FRAME).toBe(1_600);
    expect(msOfFrame(30)).toBe(1_000);
    expect(secondsOfFrames(45)).toBe(1.5);
    expect(frameOfSeconds(1)).toBe(30);
    expect(frameOfSeconds(1.01)).toBe(31);
  });
  it("starts the plan's beat 0 right after the title card", () => {
    expect(frameOfBeat(0, 120)).toBe(TITLE_CARD_FRAMES);
    expect(frameOfBeat(4, 120)).toBe(TITLE_CARD_FRAMES + 2 * FPS);
    expect(clockOf(5_430)).toBe("3:01.0");
  });
});
