// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ExportPlan, PlanResult } from "@untzel/export";
import { describe, expect, it } from "vitest";
import { announcements } from "../../../strings/en";
import { durationLabel, failureMessage, megabytes, originLabel, partLabel, planOrigin, readyAnnouncement, readyLabel, secondsLeft } from "./export-labels";

const plan = { format: "story", frame: null } as unknown as ExportPlan;
const format = { planDurationLabel: () => "0:15 + 2 s" };

describe("export labels", () => {
  it("say where the export starts: a bar, or a beat and step inside one", () => {
    expect(originLabel({ startBar: 20, startTick: 1280, bars: 8 })).toBe("from bar 21 · 8 bars");
    expect(originLabel({ startBar: 4, startTick: 288, bars: 3.5 })).toBe("from bar 5.3 · 3.5 bars");
    expect(originLabel({ startBar: 2, startTick: 168, bars: 4.375 })).toBe("from bar 3.3.3 · 4.38 bars");
  });
  it("a program's plan has an origin, a take's none", () => {
    const source = { kind: "program", mode: "loop", startBar: 20, preRollBars: 0, preRollFrames: 0, bars: 8, startTick: 1280, fadeInFrames: 0 } as const;
    expect(planOrigin({ source })).toBe("from bar 21 · 8 bars");
    expect(planOrigin({ source: { kind: "take", isCut: false } })).toBe("");
  });
  it("a duration needs the module and a plan", () => {
    const planned: PlanResult = { ok: true, plan };
    expect(durationLabel(format, planned)).toBe("0:15 + 2 s");
    expect(durationLabel(null, planned)).toBe("–");
    expect(durationLabel(format, undefined)).toBe("–");
    expect(durationLabel(format, { ok: false, reason: "TOO_LONG", maxSeconds: 600 })).toBe("–");
  });

  it("names the finished file by duration, type and size", () => {
    expect(readyLabel(format, plan, "mp4", 4_412_345, "avc1.640028, mp4a.40.2")).toBe("Ready · 0:15 + 2 s · MP4 · 4.4 MB");
    // Firefox has no AAC: the MP4's Opus sound is named, never silent.
    expect(readyLabel(format, plan, "mp4", 7_500_000, "avc1.640028, opus")).toBe("Ready · 0:15 + 2 s · MP4 · Opus audio · 7.5 MB");
    expect(readyLabel(format, plan, "wav", 4_412_345, "pcm-s24")).toBe("Ready · 0:15 + 2 s · WAV · 4.4 MB");
    expect(megabytes(267_122_555)).toBe("267.1 MB");
    expect(partLabel(1, "build", 4)).toBe("2 · build · 4 bars");
  });

  it("shows the time left only above 10 s", () => {
    expect(secondsLeft(5, 0, 100)).toBeNull();
    expect(secondsLeft(2, 50, 100)).toBeNull();
    expect(secondsLeft(12, 50, 100)).toBe(12);
  });

  it("maps each failure to its message", () => {
    expect(failureMessage("NO_VIDEO_CODEC")).toBe(announcements.exportNoH264);
    expect(announcements.exportNoH264).toBe("This device can't encode H.264 video. Try the Audio WAV export or another browser.");
    expect(failureMessage("ENCODER_BUSY")).toBe(announcements.exportEncoderBusy);
    expect(failureMessage("NO_AUDIO_CODEC")).toBe(announcements.exportNoVideo);
    expect(failureMessage("RENDERER")).toBe(announcements.exportNoVideo);
    expect(failureMessage("OUT_OF_MEMORY")).toBe(announcements.exportOutOfMemory);
    expect(failureMessage("INTERNAL")).toBe(announcements.exportFailed);
    expect(failureMessage("TAKE_INVALID")).toBe(failureMessage("INTERNAL"));
  });
  it("say which file is ready", () => {
    expect([readyAnnouncement("story"), readyAnnouncement("video"), readyAnnouncement("audio")]).toEqual([announcements.storyReady, announcements.videoReady, announcements.audioReady]);
  });
});
