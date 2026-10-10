// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The words of the export sheet that come from a plan or a result. Pure: the duration
// functions arrive from @untzel/export, which stays out of the boot chunk until needed.
import { liveStrings as strings } from "@untzel/skin";
import type { ExportPlan, ExportResult, FrameSize, PlannedSource, PlanResult } from "@untzel/export";
import { TICKS_PER_BAR, barBeatLabel } from "@untzel/session/rules";
import type { ExportFormat } from "@untzel/presentation/view-model";
import { announcements } from "../../../strings/copy";

export interface DurationFormat {
  /** "0:15 + 2 s": the light, then the closing card; "3:24" for audio. */
  readonly planDurationLabel: (plan: ExportPlan) => string;
}

type FailureReason = Extract<ExportResult, { type: "failed" }>["reason"];

const SHOW_SECONDS_LEFT_ABOVE = 10;

/** "0:15 + 2 s", or a dash before the module loads or when the plan fails. */
export function durationLabel(format: DurationFormat | null, planned: PlanResult | undefined): string {
  if (format === null || planned === undefined || !planned.ok) return "–";
  return format.planDurationLabel(planned.plan);
}

/** "1080 × 1920". */
export function resolutionLabel(frame: FrameSize): string {
  return `${frame.width} × ${frame.height}`;
}

/**
 * "Ready · 0:15 + 2 s · MP4 · 1080 × 1920 · 23.0 MB"; a WAV has no resolution. `codecs` is
 * the worker's "video, audio" list: where the browser has no AAC (Firefox) the
 * MP4 carries Opus, and the label says so instead of hiding it.
 */
export function readyLabel(format: DurationFormat, plan: ExportPlan, extension: string, bytes: number, codecs: string): string {
  const parts = [
    format.planDurationLabel(plan),
    extension.toUpperCase(),
    ...(isOpusAudio(codecs) ? [strings.exportOpusAudio] : []),
    ...(plan.frame === null ? [] : [resolutionLabel(plan.frame)]),
    megabytes(bytes),
  ];
  return strings.exportReady(parts.join(" · "));
}

function isOpusAudio(codecs: string): boolean {
  return codecs.split(", ").at(-1) === "opus";
}

/** "about 6 s to render", never under a second; null without a measured pace. */
export function estimateLabel(seconds: number | null): string | null {
  return seconds === null ? null : strings.renderEstimate(Math.max(1, Math.round(seconds)));
}

/**
 * "from bar 21 · 8 bars" in the current language (the plan's own origin is English); a
 * stretch that starts inside a bar says where, "from bar 5.3 · 3.5 bars".
 */
export function originLabel(source: Pick<Extract<PlannedSource, { kind: "program" }>, "startBar" | "startTick" | "bars">): string {
  const position = source.startTick % TICKS_PER_BAR === 0 ? String(source.startBar + 1) : barBeatLabel(source.startTick);
  return strings.exportOrigin(position, Math.round(source.bars * 100) / 100);
}

/** A program's plan says where it starts; a take's has no bar to start from. */
export function planOrigin(plan: Pick<ExportPlan, "source">): string {
  return plan.source.kind === "program" ? originLabel(plan.source) : "";
}

/** "2 · build · 4 bars": the From and To options in song mode. */
export function partLabel(index: number, section: string, bars: number): string {
  return strings.exportPart(index + 1, section, bars);
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Seconds left by the pace so far, shown only above 10 s; null otherwise. */
export function secondsLeft(elapsedSeconds: number, done: number, total: number): number | null {
  if (done <= 0) return null;
  const left = (elapsedSeconds * (total - done)) / done;
  return left > SHOW_SECONDS_LEFT_ABOVE ? Math.round(left) : null;
}

/** Why Render refused a plan, in words: the limit is named, never worked around. */
export function refusalMessage(planned: Extract<PlanResult, { ok: false }>, format: { readonly formatDuration: (seconds: number) => string }): string {
  if (planned.reason === "TOO_LONG") return announcements.exportTooLong(format.formatDuration(planned.maxSeconds));
  return announcements.exportEmptyRange;
}

/** The announcement of a finished file: flat catalog keys, so each one can be translated. */
const READY_KEYS = { story: "storyReady", video: "videoReady", audio: "audioReady" } as const;
export function readyAnnouncement(format: ExportFormat): string {
  return announcements[READY_KEYS[format]];
}
export function failureMessage(reason: FailureReason): string {
  switch (reason) {
    case "NO_VIDEO_CODEC":
      return announcements.exportNoH264;
    case "ENCODER_BUSY":
      return announcements.exportEncoderBusy;
    case "NO_AUDIO_CODEC":
    case "RENDERER":
      return announcements.exportNoVideo;
    case "OUT_OF_MEMORY":
      return announcements.exportOutOfMemory;
    // The page sends only programs; a take's failure from the worker reads as any other.
    case "TAKE_INVALID":
    case "ENCODER":
    case "INTERNAL":
      return announcements.exportFailed;
  }
}
