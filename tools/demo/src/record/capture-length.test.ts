// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { Timeline } from "../pacing";
import { MAX_STORY_SECONDS, captureSeconds, isCaptureInRange, plannedStory } from "./capture-length";
import { BRAND_CARD_FRAMES, FPS, TITLE_CARD_FRAMES, secondsOfFrames } from "./frame-time";
import { finalFrame, layerFrames } from "./gesture-schedule";

const TIMELINE: Timeline = {
  tempo: 120,
  actions: [],
  // Two seconds a bar at 120 bpm.
  layers: [
    { name: "kick", role: "kick", startBeat: 4, entersBeat: 8, endBeat: 12 },
    { name: "band", role: "band", startBeat: 12, entersBeat: 40, endBeat: 44 },
    { name: "arrangement", role: "arrangement", startBeat: 44, entersBeat: 60, endBeat: 64 },
  ],
  totalBeats: 88,
  totalSeconds: 44,
};

describe("the plan's length and its Story", () => {
  it("counts the capture from the arm, the title card included", () => {
    expect(finalFrame(TIMELINE)).toBe(TITLE_CARD_FRAMES + 44 * FPS);
    expect(captureSeconds(TIMELINE)).toBe(45.5);
    expect(isCaptureInRange(45.5)).toBe(false);
    expect(isCaptureInRange(60)).toBe(true);
    expect(isCaptureInRange(180.1)).toBe(false);
  });
  it("cuts the Story on the earliest layer start that leaves 56 s at most", () => {
    expect(layerFrames(TIMELINE)).toEqual([TITLE_CARD_FRAMES + 60, TITLE_CARD_FRAMES + 180, TITLE_CARD_FRAMES + 660]);
    const story = plannedStory(TIMELINE);
    expect(story.fromLayer).toBe("kick");
    expect(story.seconds).toBe(secondsOfFrames(TITLE_CARD_FRAMES + 44 * FPS - 60 + BRAND_CARD_FRAMES));
    expect(story.seconds).toBeLessThanOrEqual(MAX_STORY_SECONDS);
  });
  it("says so when no layer start fits and the cut falls inside one", () => {
    const long = { ...TIMELINE, layers: TIMELINE.layers.slice(0, 1), totalBeats: 200, totalSeconds: 100 };
    const story = plannedStory(long);
    expect(story.fromLayer).toBeNull();
    expect(story.seconds).toBe(MAX_STORY_SECONDS - 0.5);
  });
});
