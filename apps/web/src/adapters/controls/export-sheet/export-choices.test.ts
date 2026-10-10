// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { chooseTiers, exportCapSeconds } from "@untzel/export";
import type { ExportStretch, SessionView } from "@untzel/session";
import { describe, expect, it } from "vitest";
import {
  capSeconds,
  chosenQuality,
  effectiveQuality,
  effectiveRangeMode,
  exportRange,
  modeForFormat,
  planRequest,
  renderKey,
  stretchCap,
  type ExportChoiceState,
} from "./export-choices";

const SONG = { parts: [{ section: "intro", bars: 8 }] } as unknown as SessionView["song"];
const state = (changes: Partial<ExportChoiceState> = {}): ExportChoiceState => ({
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
const probedWithout4k = chooseTiers({
  tiers: [
    { quality: "hd", isSupported: true, framesPerSecond: 120 },
    { quality: "4k", isSupported: false, framesPerSecond: null },
  ],
});
const stretch = { startTick: 64, endTick: 192 } as ExportStretch;

describe("effectiveQuality", () => {
  it("is the choice before the module loads, HD without one", () => {
    expect(effectiveQuality(state(), null)).toBe("hd");
    expect(effectiveQuality(state({ quality: "4k" }), null)).toBe("4k");
  });
  it("keeps a choice the device offers and falls back to its default otherwise", () => {
    expect(effectiveQuality(state({ quality: "hd" }), chooseTiers(null))).toBe("hd");
    expect(effectiveQuality(state({ quality: "4k" }), probedWithout4k)).toBe(probedWithout4k.defaultQuality);
  });
});

describe("chosenQuality", () => {
  it("is null before the export module loads", () => {
    expect(chosenQuality(state({ quality: "4k" }), null)).toBeNull();
    expect(chosenQuality(state({ quality: "hd" }), chooseTiers(null))).toBe("hd");
  });
});

describe("effectiveRangeMode", () => {
  it("follows what plays until Loop or Song is picked, and Song without parts is Loop", () => {
    expect(effectiveRangeMode(state({ playing: { mode: "song", song: SONG, playing: false, position: null } }))).toBe("song");
    expect(effectiveRangeMode(state({ rangeMode: "loop", playing: { mode: "song", song: SONG, playing: false, position: null } }))).toBe("loop");
    expect(effectiveRangeMode(state({ rangeMode: "song" }))).toBe("loop");
    expect(effectiveRangeMode(state({ playing: { mode: null, song: null, playing: false, position: null } }))).toBe("loop");
  });
});

describe("modeForFormat", () => {
  it("counts on the stretch's ruler when Selected range is chosen", () => {
    expect(modeForFormat(state({ isPlayRangeChosen: true, stretchMode: () => "song" }), "story")).toBe("song");
    expect(modeForFormat(state({ isPlayRangeChosen: false, stretchMode: () => "song" }), "video")).toBe("loop");
  });
  it("the story follows what plays; the other formats the sheet's mode", () => {
    const playingSong = state({ rangeMode: "loop", playing: { mode: "song", song: SONG, playing: false, position: null } });
    expect(modeForFormat(playingSong, "story")).toBe("song");
    expect(modeForFormat(playingSong, "video")).toBe("loop");
  });
});

describe("exportRange and planRequest", () => {
  it("take the stretch only when Selected range is chosen", () => {
    expect(exportRange(state(), "video", () => stretch)).toEqual({ kind: "bars", bars: 16 });
    expect(exportRange(state({ isPlayRangeChosen: true }), "video", () => stretch)).toEqual({ kind: "span", startTick: 64, endTick: 192 });
    expect(exportRange(state(), "story", () => stretch)).toBeNull();
  });
  it("plan from the position only while the music plays", () => {
    const position = { bar: 3 } as unknown as SessionView["position"];
    expect(planRequest(state(), "video", "hd", () => null)).toEqual({ format: "video", quality: "hd", range: { kind: "bars", bars: 16 }, mode: "loop", position: null });
    expect(planRequest(state({ playing: { mode: "loop", song: null, playing: true, position } }), "video", "4k", () => null).position).toBe(position);
  });
});

describe("the cap", () => {
  const api = { chooseTiers, exportCapSeconds };
  it("is null before the export module loads", () => {
    expect(capSeconds(null, "story", "hd")).toBeNull();
    expect(stretchCap(state(), null, null)).toBeNull();
  });
  it("is the format's cap at the quality chosen now, with its note", () => {
    const seconds = exportCapSeconds("story", "hd");
    expect(capSeconds(api, "story", "hd")).toBe(seconds);
    const cap = stretchCap(state({ format: "story", quality: "hd" }), api, null);
    if (seconds === null) expect(cap).toBeNull();
    else expect(cap?.seconds).toBe(seconds);
  });
});

describe("renderKey", () => {
  it("holds the text, the format, the quality, the mode, the range and the title", () => {
    const key = renderKey(state(), { sourceHash: 7, quality: "hd", stretch: () => null, title: "Night" });
    expect(key).toBe("7|video|hd|loop|bars 16|Night");
    expect(renderKey(state({ format: "audio" }), { sourceHash: 7, quality: "4k", stretch: () => null, title: "Night" })).toBe("7|audio|wav|loop|bars 16|Night");
  });
});
