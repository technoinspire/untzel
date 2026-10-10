// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import { Transport, type PlaybackMode, type PlaybackPosition } from "@untzel/transport";
import {
  FakeClock,
  FakeEventSink,
  driveClock,
  fakeCompiler,
  fakeProgram,
  fakeSection,
  fakeTrack,
} from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import {
  TITLE_CARD_EXIT_VIDEO_FRAMES,
  exportCapSeconds,
  TITLE_CARD_VIDEO_FRAMES,
  formatDuration,
  planDurationLabel,
  planExport,
  planSeconds,
  type ExportPlan,
  type ExportRequest,
  type PlannedSource,
} from "./plan";
import { planTake } from "./take-plan";

const loopAt = (tempo: number) => fakeProgram([fakeTrack("kick")], { tempo });
const song = (loop: boolean) =>
  fakeProgram([fakeTrack("kick"), fakeTrack("hat")], {
    tempo: 132,
    sections: [fakeSection("intro", ["hat"], { tempo: 120 }), fakeSection("drop", ["kick", "hat"])],
    song: {
      parts: [
        { section: "intro", bars: 4 },
        { section: "drop", bars: 16 },
        { section: "intro", bars: 4 },
      ],
      loop,
    },
  });

function position(bar: number, partIndex: number | null, mode: PlaybackMode, patternBar = bar): PlaybackPosition {
  return {
    frame: 0,
    bar,
    patternBar,
    loopBar: null,
    loopBars: null, framesPerBar: 96_000,
    mode,
    partIndex,
    section: null,
    barInPart: null,
    totalBars: null,
  };
}

/** A program's plan with its source's fields beside the others, as the cases below read them. */
type ProgramPlan = ExportPlan & Omit<Extract<PlannedSource, { kind: "program" }>, "kind">;

function plan(program: Program, request: Partial<ExportRequest>): ProgramPlan {
  const result = planExport(program, { format: "story", quality: "hd", range: null, mode: "loop", position: null, ...request }, false);
  if (!result.ok) throw new Error(result.reason);
  const { source } = result.plan;
  if (source.kind !== "program") throw new Error("a program's plan has a program source");
  const { kind: _, ...fields } = source;
  return { ...result.plan, ...fields };
}

/** Frames between two bars of a real transport play, from the batch positions. */
function transportFrames(program: Program, mode: PlaybackMode, startBar: number, bars: number): number {
  const clock = new FakeClock(48_000);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink, compile: fakeCompiler });
  transport.setProgram(program);
  clock.set(0);
  transport.play(mode, { startBar });
  const frames = new Map<number, number>();
  while (!frames.has(startBar + bars)) {
    driveClock(transport, clock, (clock.nowFrame() ?? 0) + 48_000);
    for (const batch of sink.batches) frames.set(batch.position.bar, batch.position.frame);
  }
  return (frames.get(startBar + bars) ?? 0) - (frames.get(startBar) ?? 0);
}

describe("story", () => {
  it("is whole bars near 15 s: 3, 8 and 12 bars at 60, 132 and 200 BPM", () => {
    expect(plan(loopAt(60), {}).bars).toBe(3);
    expect(plan(loopAt(132), {}).bars).toBe(8);
    expect(plan(loopAt(200), {}).bars).toBe(12);
    for (const tempo of [60, 90, 132, 160, 200]) {
      const seconds = planSeconds(plan(loopAt(tempo), {}));
      expect(seconds).toBeGreaterThanOrEqual(14);
      expect(seconds).toBeLessThanOrEqual(17);
    }
    // Every whole tempo: just under 64 BPM, 4 bars would pass 15 s, so 3 bars ≈ 11.4 s.
    expect(plan(loopAt(63), {}).bars).toBe(3);
    for (let tempo = 60; tempo <= 200; tempo += 1) {
      const music = plan(loopAt(tempo), {}).musicSeconds;
      expect(music, `${tempo} BPM`).toBeGreaterThanOrEqual(11.4);
      expect(music, `${tempo} BPM`).toBeLessThanOrEqual(15);
    }
    const at132 = plan(loopAt(132), {});
    expect(at132.musicSeconds).toBeCloseTo(14.545, 3);
    expect(formatDuration(planSeconds(at132))).toBe("0:17");
    expect(planDurationLabel(at132)).toBe("0:15 + 2 s");
  });

  it("starts on the current bar in loop and on the current part in song", () => {
    expect(plan(loopAt(132), { position: position(21, null, "loop") })).toMatchObject({ startBar: 21, origin: "from bar 22 · 8 bars" });
    expect(plan(song(true), { mode: "song", position: position(9, 1, "song") }).startBar).toBe(4);
    expect(plan(loopAt(132), { position: null }).startBar).toBe(0);
  });

  it("starts on the bar of the pass that plays now under a written loop", () => {
    // `loop 3` entered at bar 12: bar 14 is bar 2 of its pass, as play(loop, { startBar: 2 }) is.
    const looped = fakeProgram([fakeTrack("kick")], { tempo: 132, loopBars: 3 });
    expect(plan(looped, { position: position(14, null, "loop", 2) })).toMatchObject({ startBar: 2, origin: "from bar 3 · 8 bars" });
  });

  it("moves back so a song without loop does not end inside it", () => {
    const story = plan(song(false), { mode: "song", position: position(22, 2, "song") });
    expect(story.startBar + story.bars).toBe(24);
    expect(story.startBar).toBe(24 - story.bars);
  });
});

describe("video and audio ranges", () => {
  it("cover the chosen parts with their section tempos", () => {
    const one = plan(song(true), { format: "video", mode: "song", range: { kind: "song", fromPart: 1, toPart: 1 } });
    expect(one).toMatchObject({ startBar: 4, bars: 16, origin: "from bar 5 · 16 bars" });
    const all = plan(song(true), { format: "audio", mode: "song", range: null });
    expect(all).toMatchObject({ startBar: 0, bars: 24 });
    // intro at 120 (4 + 4 bars of 96 000 frames) and drop at 132 (16 bars of 87 272.72…)
    expect(all.musicFrames).toBe(8 * 96_000 + Math.floor((16 * 240 * 48_000) / 132));
  });

  it("match the frames the transport schedules between the same bars", () => {
    for (const [program, mode, range] of [
      [song(true), "song", { kind: "song", fromPart: 1, toPart: 2 }],
      [song(true), "song", { kind: "song", fromPart: 0, toPart: 0 }],
      [loopAt(132), "loop", { kind: "bars", bars: 16 }],
    ] as const) {
      const result = plan(program, { format: "video", mode, range });
      expect(result.musicFrames).toBe(transportFrames(program, mode, result.startBar, result.bars));
    }
  });

  it("add a closing card of exactly 60 frames (2 s) to every story and video, none to audio", () => {
    for (const format of ["story", "video"] as const) {
      const result = plan(song(true), { format, mode: "song", range: null });
      expect(result.cardVideoFrames).toBe(60);
      expect(result.cardSeconds).toBe(2);
      expect(result.musicVideoFrames).toBe(Math.ceil(result.musicFrames / 1_600));
      expect(result.totalVideoFrames).toBe(result.musicVideoFrames + 60);
      expect(result.maxTailSeconds).toBe(0);
    }
    const audio = plan(song(true), { format: "audio", mode: "song", range: null });
    expect(audio).toMatchObject({ cardVideoFrames: 0, musicVideoFrames: 0, totalVideoFrames: 0, maxTailSeconds: 4 });
    expect(planDurationLabel(audio)).toBe(formatDuration(audio.musicSeconds));
  });

  it("follow the mode: bar counts in loop, parts in song", () => {
    const fail = (request: Partial<ExportRequest>, program: Program = song(true)) =>
      planExport(program, { format: "video", quality: "hd", range: null, mode: "loop", position: null, ...request }, false);
    expect(plan(song(true), { format: "video", mode: "loop", range: { kind: "bars", bars: 32 } })).toMatchObject({ startBar: 0, bars: 32 });
    expect(plan(song(true), { format: "video", mode: "loop", range: null }).bars).toBe(16);
    expect(fail({ mode: "loop", range: { kind: "song", fromPart: 0, toPart: 1 } })).toMatchObject({ ok: false, reason: "EMPTY_RANGE" });
    expect(fail({ mode: "song", range: { kind: "bars", bars: 8 } })).toMatchObject({ ok: false, reason: "EMPTY_RANGE" });
    expect(fail({ mode: "song", range: { kind: "song", fromPart: 2, toPart: 1 } })).toMatchObject({ ok: false, reason: "EMPTY_RANGE" });
    expect(fail({ mode: "song", range: { kind: "song", fromPart: 0, toPart: 3 } })).toMatchObject({ ok: false, reason: "EMPTY_RANGE" });
    expect(fail({ mode: "song" }, loopAt(132))).toMatchObject({ ok: false, reason: "EMPTY_RANGE" });
    expect(planExport(null, { format: "video", quality: "hd", range: null, mode: "loop", position: null }, false)).toMatchObject({ ok: false, reason: "NO_PROGRAM" });
  });

  it("refuse more than 10 minutes", () => {
    const long = fakeProgram([fakeTrack("kick")], {
      tempo: 60,
      sections: [fakeSection("a", ["kick"])],
      song: { parts: [{ section: "a", bars: 151 }], loop: false },
    });
    expect(planExport(long, { format: "audio", quality: "hd", range: null, mode: "song", position: null }, false)).toEqual({ ok: false, reason: "TOO_LONG", maxSeconds: 600 });
    const fits = { ...long, song: { parts: [{ section: "a", bars: 150 }], loop: false } };
    expect(planExport(fits, { format: "audio", quality: "hd", range: null, mode: "song", position: null }, false).ok).toBe(true);
  });

  it("refuse a 4K video above 1 GB rather than render it smaller: 4:21 of music and the card", () => {
    const minutes = (bars: number) =>
      fakeProgram([fakeTrack("kick")], { tempo: 60, sections: [fakeSection("a", ["kick"])], song: { parts: [{ section: "a", bars }], loop: false } });
    // 65 bars at 60 BPM = 260 s fits; 66 bars = 264 s does not.
    const request = { format: "video", range: null, mode: "song", position: null } as const;
    expect(planExport(minutes(65), { ...request, quality: "4k" }, false).ok).toBe(true);
    expect(planExport(minutes(66), { ...request, quality: "4k" }, false)).toEqual({ ok: false, reason: "TOO_LONG", maxSeconds: 261 });
    expect(planExport(minutes(66), { ...request, quality: "hd" }, false).ok).toBe(true);
  });
});

describe("the export stretch", () => {
  const barFrames = (240 * 48_000) / 132;

  it("turns bars 9–28 into 20 bars from 0-based bar 8, to the sample, after a 1-bar pre-roll", () => {
    const range = plan(loopAt(132), { format: "video", mode: "loop", range: { kind: "span", startTick: 512, endTick: 1792 } });
    expect(range).toMatchObject({ startBar: 8, bars: 20, preRollBars: 1, origin: "from bar 9 · 20 bars" });
    // The transport's floor at both ends: frame(28) − frame(8), and the pre-roll frame(8) − frame(7).
    expect(range.musicFrames).toBe(Math.floor(28 * barFrames) - Math.floor(8 * barFrames));
    expect(range.preRollFrames).toBe(Math.floor(8 * barFrames) - Math.floor(7 * barFrames));
    expect(range.musicFrames).toBe(transportFrames(loopAt(132), "loop", 8, 20));
    // 20 bars at 132 BPM plus the 2 s card: 36.36 s + 2 s.
    expect(range.totalVideoFrames).toBe(Math.ceil(range.musicFrames / 1_600) + 60);
  });

  it("follows the section tempos in song mode and plays the range once", () => {
    const range = plan(song(true), { format: "audio", mode: "song", range: { kind: "span", startTick: 256, endTick: 1280 } });
    expect(range).toMatchObject({ startBar: 4, bars: 16, preRollBars: 1 });
    expect(range.musicFrames).toBe(Math.floor((16 * 240 * 48_000) / 132));
    // The pre-roll is the intro's last bar, at 120 BPM.
    expect(range.preRollFrames).toBe(96_000);
  });

  it("needs no pre-roll from bar 1, and leaves every other range without one", () => {
    expect(plan(loopAt(132), { format: "video", range: { kind: "span", startTick: 0, endTick: 256 } })).toMatchObject({ startBar: 0, bars: 4, preRollBars: 0, preRollFrames: 0 });
    expect(plan(loopAt(132), { format: "video", range: { kind: "bars", bars: 16 } }).preRollBars).toBe(0);
    expect(plan(loopAt(132), {}).preRollBars).toBe(0);
  });

  it("a story of a stretch starts and ends where it does, up to 1:00", () => {
    const short = plan(loopAt(132), { format: "story", mode: "loop", range: { kind: "span", startTick: 256, endTick: 512 } });
    expect(short).toMatchObject({ format: "story", startBar: 4, bars: 4, preRollBars: 1, origin: "from bar 5 · 4 bars" });
    expect(short.totalVideoFrames).toBe(Math.ceil(transportFrames(loopAt(132), "loop", 4, 4) / 1_600) + 60);
    // 20 bars at 132 BPM are 36 s: under the Story's minute, so all of them.
    const long = plan(loopAt(132), { format: "story", mode: "loop", range: { kind: "span", startTick: 512, endTick: 1792 } });
    expect(long).toMatchObject({ startBar: 8, bars: 20 });
    // 34 bars at 132 BPM are 61.8 s: past the minute, refused (the sheet trims before asking).
    const tooLong = planExport(loopAt(132), { format: "story", quality: "hd", range: { kind: "span", startTick: 0, endTick: 2176 }, mode: "loop", position: null }, false);
    expect(tooLong).toEqual({ ok: false, reason: "TOO_LONG", maxSeconds: 60 });
  });
  it("starts a stretch on a step: the steps into its bar join the pre-roll, with a 10 ms fade-in", () => {
    // Bar 3, beat 3, step 3 (tick 168) to bar 7 (tick 448): 4.375 bars.
    const stepped = plan(loopAt(132), { format: "story", mode: "loop", range: { kind: "span", startTick: 168, endTick: 448 } });
    const frameOfTick = (tick: number) => Math.floor((tick / 64) * barFrames);
    expect(stepped).toMatchObject({ startBar: 2, preRollBars: 1, bars: 4.375, fadeInFrames: 480, origin: "from bar 3.3.3 · 4.38 bars" });
    expect(stepped.preRollFrames).toBe(frameOfTick(168) - frameOfTick(64));
    expect(stepped.musicFrames).toBe(frameOfTick(448) - frameOfTick(168));
    expect(plan(loopAt(132), { format: "video", range: { kind: "span", startTick: 0, endTick: 256 } }).fadeInFrames).toBe(0);
    expect(plan(loopAt(132), { format: "video", range: { kind: "bars", bars: 16 } }).fadeInFrames).toBe(0);
  });
  it("caps each format: the Story 1:00, the video and the WAV 10:00, 4K at its measured 4:21", () => {
    expect(exportCapSeconds("story", "hd")).toBe(60);
    expect(exportCapSeconds("story", "4k")).toBe(60);
    expect(exportCapSeconds("video", "hd")).toBe(600);
    expect(exportCapSeconds("video", "4k")).toBe(261);
    expect(exportCapSeconds("audio", "4k")).toBe(600);
  });
  it("refuses a backwards stretch, one under a bar, or one past the end of a song that does not loop", () => {
    const fail = (startTick: number, endTick: number, program: Program, mode: PlaybackMode) =>
      planExport(program, { format: "video", quality: "hd", range: { kind: "span", startTick, endTick }, mode, position: null }, false);
    expect(fail(640, 576, loopAt(132), "loop")).toMatchObject({ ok: false, reason: "EMPTY_RANGE" });
    expect(fail(-64, 256, loopAt(132), "loop")).toMatchObject({ ok: false, reason: "EMPTY_RANGE" });
    expect(fail(128, 188, loopAt(132), "loop")).toMatchObject({ ok: false, reason: "EMPTY_RANGE" });
    expect(fail(19 * 64, 25 * 64, song(false), "song")).toMatchObject({ ok: false, reason: "EMPTY_RANGE" });
    expect(fail(19 * 64, 24 * 64, song(false), "song").ok).toBe(true);
  });
});
describe("frame and quality", () => {
  it("carry the tier's frame size and bitrate in the format's ratio, and none for audio", () => {
    const at = (format: "story" | "video" | "audio", quality: "hd" | "4k") => plan(song(true), { format, quality, mode: "song", range: null });
    expect(at("story", "hd")).toMatchObject({ quality: "hd", frame: { width: 1080, height: 1920 }, videoBitrate: 12_000_000 });
    expect(at("video", "hd")).toMatchObject({ frame: { width: 1920, height: 1080 }, videoBitrate: 12_000_000 });
    expect(at("video", "4k")).toMatchObject({ quality: "4k", frame: { width: 3840, height: 2160 }, videoBitrate: 30_000_000 });
    expect(at("audio", "4k")).toMatchObject({ quality: null, frame: null, videoBitrate: null });
  });

});
describe("the song's title card", () => {
  it("lasts 1.5 s at 30 fps, the last 0.3 s its exit", () => {
    expect(TITLE_CARD_VIDEO_FRAMES).toBe(45);
    expect(TITLE_CARD_EXIT_VIDEO_FRAMES).toBe(9);
  });
});
describe("a take", () => {
  const take = (seconds: number, format: ExportRequest["format"], quality: ExportRequest["quality"] = "hd") => {
    const result = planTake(seconds, { format, quality }, false);
    if (!result.ok) throw new Error(result.reason);
    return result.plan;
  };
  it("renders the take's seconds to the frame, with the program's card and tail and no origin", () => {
    const video = take(42.5, "video");
    expect(video).toMatchObject({ source: { kind: "take", isCut: false }, musicFrames: 2_040_000, musicSeconds: 42.5, origin: "" });
    expect(video).toMatchObject({ musicVideoFrames: 1_275, cardVideoFrames: 60, totalVideoFrames: 1_335, cardSeconds: 2, maxTailSeconds: 0 });
    expect(video).toMatchObject({ quality: "hd", frame: { width: 1920, height: 1080 }, videoBitrate: 12_000_000 });
    expect(take(10.000_01, "video").musicFrames).toBe(480_000);
    expect(take(42.5, "audio")).toMatchObject({ musicFrames: 2_040_000, cardVideoFrames: 0, totalVideoFrames: 0, maxTailSeconds: 4, quality: null, frame: null });
    expect(planDurationLabel(take(42.5, "audio"))).toBe("0:43");
    expect(planTake(42.5, { format: "story", quality: "hd" }, true)).toMatchObject({ ok: true, plan: { reducedMotion: true } });
  });
  it("cuts at the format's cap: the Story at 1:00, the video and the WAV at 10:00, 4K at 4:21", () => {
    expect(take(75, "story").source).toEqual({ kind: "take", isCut: true });
    expect(take(75, "story").musicFrames).toBe(60 * 48_000);
    expect(take(60, "story").source).toEqual({ kind: "take", isCut: false });
    expect(take(75, "video").source).toEqual({ kind: "take", isCut: false });
    expect(take(700, "video").musicFrames).toBe(600 * 48_000);
    expect(take(700, "audio")).toMatchObject({ source: { isCut: true }, musicFrames: 600 * 48_000 });
    expect(take(300, "video", "4k")).toMatchObject({ source: { isCut: true }, musicFrames: 261 * 48_000 });
  });
  it("refuses a take under a second", () => {
    expect(planTake(0.99, { format: "video", quality: "hd" }, false)).toEqual({ ok: false, reason: "EMPTY_RANGE", maxSeconds: 600 });
    expect(planTake(Number.NaN, { format: "story", quality: "hd" }, false)).toEqual({ ok: false, reason: "EMPTY_RANGE", maxSeconds: 60 });
    expect(planTake(1, { format: "story", quality: "hd" }, false).ok).toBe(true);
  });
});
