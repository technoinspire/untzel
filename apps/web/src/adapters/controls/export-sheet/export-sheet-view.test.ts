// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { strings } from "@untzel/skin";
import * as ExportModule from "@untzel/export";
import { brandLayout, chooseTiers, estimateRenderSeconds, frameSize, type PlanResult } from "@untzel/export";
import type { SessionView } from "@untzel/session";
import { describe, expect, it } from "vitest";
import type { ExportChoiceState } from "./export-choices";
import { exportView, formatDuration, partOptions, qualityNote, qualityOptions, sheetPreview, sheetStatus, withListening, type ExportSheetState } from "./export-sheet-view";
import type { KeptExport } from "../export/kept-exports";

const api = { brandLayout, estimateRenderSeconds, frameSize };
const planned = (totalVideoFrames: number): PlanResult => ({ ok: true, plan: { totalVideoFrames } }) as unknown as PlanResult;
const probed = chooseTiers({
  tiers: [
    { quality: "hd", isSupported: true, framesPerSecond: 120 },
    { quality: "4k", isSupported: true, framesPerSecond: 40 },
  ],
});

describe("qualityOptions", () => {
  it("names each offered tier in the format's ratio with the time the probe measured", () => {
    const options = qualityOptions(api, probed, "video", () => planned(510), true);
    expect(options.map((option) => option.resolution)).toEqual(["1920 × 1080", "3840 × 2160"]);
    // 510 frames at 4× real time: about 4 s; at 40 frames/s, about 13 s.
    expect(options[0]?.estimate).toBe("about 4 s to render");
    expect(options[1]?.estimate).toBe("about 13 s to render");
  });

  it("adds the encoder's ~2 s start to the first render of the page", () => {
    const options = qualityOptions(api, probed, "video", () => planned(510), false);
    expect(options[0]?.estimate).toBe("about 6 s to render");
    expect(options[1]?.estimate).toBe("about 15 s to render");
  });

  it("offers HD and 4K at once and promises no time before the device is probed", () => {
    const options = qualityOptions(api, chooseTiers(null), "story", () => planned(510), false);
    expect(options).toEqual([
      { quality: "hd", resolution: "1080 × 1920", estimate: null },
      { quality: "4k", resolution: "2160 × 3840", estimate: null },
    ]);
  });

  it("promises no time for a plan that cannot render", () => {
    const refused = { ok: false, reason: "TOO_LONG", maxSeconds: 224 } as PlanResult;
    expect(qualityOptions(api, probed, "video", () => refused, true).every((option) => option.estimate === null)).toBe(true);
  });

  it("shows the audio's sibling picture size, so the list does not jump", () => {
    expect(qualityOptions(api, probed, "audio", () => planned(510), true)[0]?.resolution).toBe("1080 × 1920");
  });
});

describe("qualityNote", () => {
  it("says Render checks the device only before the first probe", () => {
    expect(qualityNote(chooseTiers(null))).toBe(strings.checksDeviceFirst);
    expect(qualityNote(probed)).toBeNull();
    expect(qualityNote(null)).toBeNull();
  });
});

describe("sheetPreview", () => {
  it("draws the format's own composition, the same at HD and 4K", () => {
    expect(sheetPreview(api, "video").aspect).toBeCloseTo(16 / 9, 9);
    expect(sheetPreview(api, "audio").aspect).toBeCloseTo(9 / 16, 9);
  });
});

const SONG = { parts: [{ section: "intro", bars: 8 }, { section: "drop", bars: 16 }] } as unknown as SessionView["song"];
const choices = (changes: Partial<ExportChoiceState> = {}): ExportChoiceState => ({
  format: "video",
  quality: null,
  rangeMode: null,
  isPlayRangeChosen: false,
  stretchMode: () => null,
  songRange: null,
  bars: 16,
  playing: { mode: "loop", song: null, playing: false, position: null },
  ...changes,
});
const idleJobs = { runningPlan: null, progress: null, secondsLeft: null, isEncoderStarted: false, isChecking: false, isRendering: false, isStarting: false };
const sheet = (changes: Partial<ExportSheetState> = {}): ExportSheetState => ({
  api: null,
  choices: choices(),
  jobs: idleJobs,
  probe: null,
  shown: null,
  plan: () => planned(510),
  stretch: null,
  isListening: false,
  isStretchChosen: false,
  music: { song: null, solo: null },
  hasProgram: true,
  message: null,
  isVideoUnavailable: false,
  previewStill: null,
  ...changes,
});
const kept = { label: "story.mp4 · 2 MB", canShare: true, url: "blob:story", format: "story", plan: { source: { kind: "program", startBar: 0, startTick: 0, bars: 8 } } } as unknown as KeptExport;

describe("sheetStatus", () => {
  it("checks the device while the probe runs, or before it reaches the worker for a video", () => {
    expect(sheetStatus(sheet({ jobs: { ...idleJobs, isChecking: true, isRendering: true } }))).toBe("checking");
    expect(sheetStatus(sheet({ jobs: { ...idleJobs, isStarting: true, isRendering: true } }))).toBe("checking");
    expect(sheetStatus(sheet({ choices: choices({ format: "audio" }), jobs: { ...idleJobs, isStarting: true, isRendering: true } }))).toBe("rendering");
  });
  it("is done with a kept file, failed with a message, idle otherwise", () => {
    expect(sheetStatus(sheet({ shown: kept }))).toBe("done");
    expect(sheetStatus(sheet({ message: "Try again" }))).toBe("failed");
    expect(sheetStatus(sheet())).toBe("idle");
  });
});

describe("partOptions", () => {
  const song = { mode: "song" as const, song: SONG, playing: false, position: null };
  it("lists the song's parts in Song, once the module and a program are there", () => {
    const state = sheet({ api: ExportModule, choices: choices({ playing: song }), music: { song: SONG, solo: null } });
    expect(partOptions(state).map((part) => part.index)).toEqual([0, 1]);
    expect(partOptions({ ...state, api: null })).toEqual([]);
    expect(partOptions({ ...state, hasProgram: false })).toEqual([]);
    expect(partOptions({ ...state, choices: choices({ rangeMode: "loop", playing: song }) })).toEqual([]);
  });
});

describe("formatDuration and withListening", () => {
  it("is a dash before the module loads; the audio says WAV", () => {
    expect(formatDuration(sheet(), "video")).toBe("–");
    expect(formatDuration(sheet(), "audio")).toBe("– · WAV");
  });
  it("adds the listening to a stretch, and nothing without one", () => {
    const stretch = { isListening: false } as unknown as NonNullable<ExportSheetState["stretch"]>;
    expect(withListening(stretch, true)?.isListening).toBe(true);
    expect(withListening(null, true)).toBeNull();
  });
});

describe("exportView", () => {
  it("before the module loads: the choices, no qualities, no preview, no result", () => {
    const view = exportView(sheet());
    expect(view).toMatchObject({ format: "video", status: "idle", quality: "hd", qualities: [], preview: null, result: null, rangeMode: "loop", range: { bars: 16 }, origin: "" });
    expect(view.durations).toEqual({ story: "–", video: "–", audio: "– · WAV" });
  });
  it("shows the kept file as done, at full progress, from the bar it started on", () => {
    const view = exportView(sheet({ shown: kept, music: { song: SONG, solo: "kick" } as unknown as ExportSheetState["music"] }));
    expect(view).toMatchObject({ status: "done", progress: 1, result: { label: "story.mp4 · 2 MB", canShare: true, url: "blob:story", kind: "video" }, canChooseSong: true, isSoloHeld: true });
    expect(view.origin).not.toBe("");
  });

});
