// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What an export renders, computed before rendering: pure, tested without a browser. The
// arrangement and the bar → frame conversion are core's, the same the transport uses, so
// the export starts and ends exactly where the transport would.
import {
  buildArrangement,
  frameAt,
  originAtBar,
  rational,
  toNumber,
  type Arrangement,
  type Program,
} from "@untzel/core";
import { barBeatLabel } from "@untzel/session/rules";
import type { PlaybackMode, PlaybackPosition } from "@untzel/session";
import { frameSize, maxSecondsFor, VIDEO_BITRATES, type ExportQuality, type FrameSize } from "./probe/tiers";

/** Story 9:16, Video 16:9, and the WAV. */
export type ExportFormat = "story" | "video" | "audio";
export type ExportRange =
  | { readonly kind: "song"; readonly fromPart: number; readonly toPart: number } // inclusive
  | { readonly kind: "bars"; readonly bars: 8 | 16 | 32 | 64 }
  /**
   * The export's stretch: ticks of 1/64 bar from the
   * ruler's left edge, half-open; "Bars 9–28" is { startTick: 512, endTick: 1792 }. It may
   * start and end on any step. It plays once (Cycle does not repeat), after a pre-roll from
   * the bar before its start that is rendered and discarded.
   */
  | { readonly kind: "span"; readonly startTick: number; readonly endTick: number };
export const EXPORT_BAR_CHOICES = [8, 16, 32, 64] as const;
export const DEFAULT_EXPORT_BARS = 16;

export interface ExportRequest {
  readonly format: ExportFormat;
  /** Ignored for audio. */
  readonly quality: ExportQuality;
  /** Null for the default range (all parts, or 16 bars, or in the story what plays now); a span in every format. */
  readonly range: ExportRange | null;
  /** The story: what plays now. The other formats: the range the sheet picked, loop or song. */
  readonly mode: PlaybackMode;
  /** Null when stopped. */
  readonly position: PlaybackPosition | null;
}

export const SAMPLE_RATE = 48_000;
export const FPS = 30;
/** 48 000 / 30, exact. */
export const SAMPLES_PER_VIDEO_FRAME = SAMPLE_RATE / FPS;
/** The closing card: two seconds, required by the license. No option removes it. */
export const CARD_SECONDS = 2;
export const CARD_VIDEO_FRAMES = CARD_SECONDS * FPS;
/** The song's title card over the first light frames; the caption follows. */
export const TITLE_CARD_SECONDS = 1.5;
/** Its exit, the last 300 ms of the card. */
export const TITLE_CARD_EXIT_SECONDS = 0.3;
export const TITLE_CARD_VIDEO_FRAMES = Math.round(TITLE_CARD_SECONDS * FPS);
export const TITLE_CARD_EXIT_VIDEO_FRAMES = Math.round(TITLE_CARD_EXIT_SECONDS * FPS);
export const MAX_TAIL_SECONDS = 4;
export const MAX_EXPORT_SECONDS = 600;
/** Story length targets: about 14 s of whole bars, never above 15 s. */
const STORY_TARGET_SECONDS = 14;
const STORY_MAX_SECONDS = 15;
/** A chosen stretch: the Story up to 1:00, the video and the WAV up to 10:00. */
export const STORY_STRETCH_MAX_SECONDS = 60;
/** 10 ms of fade-in where a stretch cuts into the music, so its first sample never clicks. */
export const CUT_FADE_FRAMES = 480;
const TICKS_PER_BAR = 64;

/** What sample 0 and the length come from: a stretch of the program, or a take. */
export type PlannedSource =
  | {
      readonly kind: "program";
      readonly mode: PlaybackMode;
      /** Export sample 0: an arrangement bar in song mode, an absolute bar in loop (0-based). */
      readonly startBar: number;
      /** Bars rendered before startBar and discarded, so tails from before a span sound natural: 1 for a span, else 0. */
      readonly preRollBars: 0 | 1;
      /**
       * Exact frames from where the transport starts (startBar − preRollBars) to export sample
       * 0: the pre-roll bar and, for a stretch that starts on a step, the steps into its bar.
       */
      readonly preRollFrames: number;
      /** Whole bars, or a fraction for a stretch that ends on a step. */
      readonly bars: number;
      /** Export sample 0 in ticks of 1/64 bar from the ruler's left edge (startBar × 64 off a stretch). */
      readonly startTick: number;
      /** A stretch cut into the music: 480 frames (10 ms) of fade-in; 0 from the very start. */
      readonly fadeInFrames: number;
    }
  /** isCut: the take is longer than the format takes, and the file stops at the cap (RF9). */
  | { readonly kind: "take"; readonly isCut: boolean };

export interface ExportPlan {
  readonly format: ExportFormat;
  readonly source: PlannedSource;
  /** Exact: frameAt(o, startBar + bars) − frameAt(o, startBar), each end with its origin. */
  readonly musicFrames: number;
  /** musicFrames / 48 000, for labels only. */
  readonly musicSeconds: number;
  /** ceil(musicFrames / 1 600); 0 for audio. */
  readonly musicVideoFrames: number;
  /** Always 60 in story and video; 0 for audio. */
  readonly cardVideoFrames: 0 | 60;
  /** musicVideoFrames + cardVideoFrames; the MP4 audio has totalVideoFrames × 1 600 samples. */
  readonly totalVideoFrames: number;
  readonly cardSeconds: 0 | 2;
  /** Audio only: the tail after the music, until silence or 4 s. */
  readonly maxTailSeconds: 0 | 4;
  readonly sampleRate: 48_000;
  readonly fps: 30;
  /** Null for audio. */
  readonly quality: ExportQuality | null;
  /** The encoded frame: the tier's size in the format's ratio; null for audio. */
  readonly frame: FrameSize | null;
  /** Constant bitrate of the video track; null for audio. */
  readonly videoBitrate: number | null;
  readonly reducedMotion: boolean;
  /** "from bar 21 · 8 bars" (1-based); empty for a take. */
  readonly origin: string;
}

export type PlanFailure = "TOO_LONG" | "EMPTY_RANGE" | "NO_PROGRAM";
export type PlanResult =
  | { readonly ok: true; readonly plan: ExportPlan }
  /** maxSeconds: the longest file this format and quality allow, for the refusal's words. */
  | { readonly ok: false; readonly reason: PlanFailure; readonly maxSeconds: number };

interface Span {
  /** 0-based bar holding the first sample. */
  readonly startBar: number;
  readonly preRollBars: 0 | 1;
  readonly startTick: number;
  readonly endTick: number;
}

function wholeBars(startBar: number, bars: number): Span {
  return { startBar, preRollBars: 0, startTick: startBar * TICKS_PER_BAR, endTick: (startBar + bars) * TICKS_PER_BAR };
}

export function planExport(program: Program | null, request: ExportRequest, reducedMotion: boolean): PlanResult {
  const isStretch = request.range?.kind === "span";
  const maxSeconds = isStretch ? exportCapSeconds(request.format, request.quality) : request.format === "audio" ? MAX_EXPORT_SECONDS : Math.min(MAX_EXPORT_SECONDS, maxSecondsFor(request.quality) - CARD_SECONDS);
  if (program === null) return { ok: false, reason: "NO_PROGRAM", maxSeconds };
  const arrangement = buildArrangement(program);
  if (request.mode === "song" && arrangement === null) return { ok: false, reason: "EMPTY_RANGE", maxSeconds };
  const span = request.format === "story" && !isStretch ? storySpan(program, arrangement, request) : rangeSpan(arrangement, request.mode, request.range);
  if (span === null) return { ok: false, reason: "EMPTY_RANGE", maxSeconds };
  const at = (tick: number): number => frameAtTick(program, arrangement, request.mode, tick);
  const musicFrames = at(span.endTick) - at(span.startTick);
  const preRollFrames = at(span.startTick) - at((span.startBar - span.preRollBars) * TICKS_PER_BAR);
  const musicSeconds = musicFrames / SAMPLE_RATE;
  if (musicSeconds > maxSeconds) return { ok: false, reason: "TOO_LONG", maxSeconds };
  const bars = (span.endTick - span.startTick) / TICKS_PER_BAR;
  const source: PlannedSource = {
    kind: "program",
    mode: request.mode,
    startBar: span.startBar,
    preRollBars: span.preRollBars,
    preRollFrames,
    bars,
    startTick: span.startTick,
    fadeInFrames: isStretch && span.startTick > 0 ? CUT_FADE_FRAMES : 0,
  };
  return { ok: true, plan: framePlan(request, musicFrames, source, reducedMotion, originLabel(span.startTick, bars)) };
}

/** What follows from the length of the music and the format, the same for a program and a take (take-plan.ts). */
export function framePlan(
  request: Pick<ExportRequest, "format" | "quality">,
  musicFrames: number,
  source: PlannedSource,
  reducedMotion: boolean,
  origin: string,
): ExportPlan {
  const isVideo = request.format !== "audio";
  const musicVideoFrames = isVideo ? Math.ceil(musicFrames / SAMPLES_PER_VIDEO_FRAME) : 0;
  const cardVideoFrames = isVideo ? (CARD_VIDEO_FRAMES as 60) : 0;
  return {
    format: request.format,
    source,
    musicFrames,
    musicSeconds: musicFrames / SAMPLE_RATE,
    musicVideoFrames,
    cardVideoFrames,
    totalVideoFrames: musicVideoFrames + cardVideoFrames,
    cardSeconds: isVideo ? (CARD_SECONDS as 2) : 0,
    maxTailSeconds: isVideo ? 0 : MAX_TAIL_SECONDS,
    sampleRate: SAMPLE_RATE,
    fps: FPS,
    quality: request.format === "audio" ? null : request.quality,
    frame: request.format === "audio" ? null : frameSize(request.format, request.quality),
    videoBitrate: request.format === "audio" ? null : VIDEO_BITRATES[request.quality],
    reducedMotion,
    origin,
  };
}

/**
 * The longest stretch a format takes, the 2 s card not counted: the
 * Story 1:00, the video and the WAV 10:00; 4K keeps its measured cap (4:21).
 */
export function exportCapSeconds(format: ExportFormat, quality: ExportQuality): number {
  if (format === "audio") return MAX_EXPORT_SECONDS;
  const tier = maxSecondsFor(quality) - CARD_SECONDS;
  return Math.min(format === "story" ? STORY_STRETCH_MAX_SECONDS : MAX_EXPORT_SECONDS, tier);
}

/** "from bar 13 · 16 bars"; a stretch on a step, "from bar 3.2.3 · 4.25 bars". */
function originLabel(startTick: number, bars: number): string {
  const onBar = startTick % TICKS_PER_BAR === 0;
  const start = onBar ? String(startTick / TICKS_PER_BAR + 1) : barBeatLabel(startTick);
  const length = Number.isInteger(bars) ? String(bars) : String(Math.round(bars * 100) / 100);
  return `from bar ${start} · ${length} bars`;
}

/** Seconds the finished file lasts: video with its card, audio without its tail. */
export function planSeconds(plan: ExportPlan): number {
  return plan.format === "audio" ? plan.musicSeconds : plan.totalVideoFrames / FPS;
}

/** "0:15 + 2 s" for a video (its light, then the closing card), "3:24" for audio. */
export function planDurationLabel(plan: ExportPlan): string {
  if (plan.format === "audio") return formatDuration(plan.musicSeconds);
  return `${formatDuration(plan.musicVideoFrames / FPS)} + ${plan.cardSeconds} s`;
}

/** m:ss, rounded to the second. */
export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function storySpan(program: Program, arrangement: Arrangement | null, request: ExportRequest): Span {
  const position = request.position;
  let startBar = 0;
  if (position !== null) {
    // The bar the patterns read: with `loop <bars>` the pass may have started anywhere, and
    // play(loop, { startBar }) puts a bar below the length on that bar of the first pass.
    if (request.mode === "loop") startBar = position.patternBar;
    else startBar = arrangement?.parts[position.partIndex ?? 0]?.start ?? 0;
  }
  const tempo =
    request.mode === "song"
      ? toNumber(originAtBar(program, arrangement, "song", startBar, SAMPLE_RATE).tempo)
      : toNumber(program.tempo);
  const barSeconds = 240 / tempo;
  const bars = Math.min(
    Math.max(Math.round(STORY_TARGET_SECONDS / barSeconds), 1),
    Math.max(Math.floor(STORY_MAX_SECONDS / barSeconds), 1),
  );
  if (request.mode === "song" && arrangement !== null && !arrangement.loops) {
    if (startBar + bars > arrangement.totalBars) startBar = Math.max(0, arrangement.totalBars - bars);
    return wholeBars(startBar, Math.min(bars, arrangement.totalBars - startBar));
  }
  return wholeBars(startBar, bars);
}

/** The range follows the mode: song ranges in song mode, bar counts in loop mode. */
function rangeSpan(arrangement: Arrangement | null, mode: PlaybackMode, range: ExportRange | null): Span | null {
  if (range?.kind === "span") return playRangeSpan(arrangement, mode, range);
  if (mode === "loop") {
    if (range?.kind === "song") return null;
    return wholeBars(0, range?.bars ?? DEFAULT_EXPORT_BARS);
  }
  if (arrangement === null || range?.kind === "bars") return null;
  const fromPart = range?.fromPart ?? 0;
  const toPart = range?.toPart ?? arrangement.parts.length - 1;
  const from = arrangement.parts[fromPart];
  const to = arrangement.parts[toPart];
  if (!Number.isInteger(fromPart) || !Number.isInteger(toPart)) return null;
  if (from === undefined || to === undefined || fromPart > toPart) return null;
  return wholeBars(from.start, to.start + to.bars - from.start);
}

/** Ticks 512–1792 → bar 8 (0-based) on, after a pre-roll bar; inside the song when the song does not loop. */
function playRangeSpan(arrangement: Arrangement | null, mode: PlaybackMode, range: Extract<ExportRange, { kind: "span" }>): Span | null {
  const { startTick, endTick } = range;
  if (!Number.isInteger(startTick) || !Number.isInteger(endTick) || startTick < 0 || endTick - startTick < TICKS_PER_BAR) return null;
  if (mode === "song" && (arrangement === null || (!arrangement.loops && endTick > arrangement.totalBars * TICKS_PER_BAR))) return null;
  const startBar = Math.floor(startTick / TICKS_PER_BAR);
  return { startBar, preRollBars: startBar > 0 ? 1 : 0, startTick, endTick };
}

/** The frame of a tick (1/64 bar), with the tempo origin of the bar that holds it. */
export function frameAtTick(program: Program, arrangement: Arrangement | null, mode: PlaybackMode, tick: number): number {
  const origin = originAtBar(program, arrangement, mode, Math.floor(tick / TICKS_PER_BAR), SAMPLE_RATE);
  return frameAt(origin, rational(BigInt(tick), BigInt(TICKS_PER_BAR)));
}
