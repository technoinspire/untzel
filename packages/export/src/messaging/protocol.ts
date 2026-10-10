// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Page ↔ export worker, all by postMessage. The card ImageBitmap is transferred.
import type { SamplePackData } from "@untzel/audio/protocol";
import type { Program } from "@untzel/core";
import type { RateControlReport } from "../video/bitrate-governor";
import type { AudioCodecChoice, VideoCodecChoice } from "../codecs/codecs";
import type { ExportPlan } from "../plan";
import type { DspCounters } from "../audio/render-audio";
import type { FrameTitle } from "../title/title-overlays";
import type { DeviceProbe } from "../probe/tiers";

/**
 * The codec probe and the encoder delay of a video job. A worker lives for one job, so
 * the page keeps this and hands it to the next job: the probe runs once per page load, not
 * on every format change. It only exists once a video was rendered with it: a probe that
 * failed or ran out of time is never kept, and the next Render probes again.
 */
export interface ProbedCodecs {
  readonly video: VideoCodecChoice;
  readonly audio: AudioCodecChoice;
  /** Null when the round trip was not measured (the render uses 0). */
  readonly audioDelay: number | null;
}

/** What a job renders: a program from its plan, or a take as its encoded text. */
export type ExportSource = { readonly kind: "program"; readonly program: Program } | { readonly kind: "take"; readonly take: string };
export type MainToExportWorker =
  | {
      readonly type: "start";
      readonly jobId: number;
      readonly plan: ExportPlan;
      readonly source: ExportSource;
      readonly module: WebAssembly.Module;
      /** prepareVideoBranding's brand mark and closing card, the plan's frame size; null for audio. */
      readonly mark: ImageBitmap | null;
      readonly card: ImageBitmap | null;
      /** The song's title card and caption, the frame's size; null for audio. */
      readonly title: FrameTitle | null;
      /** The song's title for the file's metadata (MP4 title, WAV INAM); null without one. */
      readonly songTitle: string | null;
      readonly instrumentHashes: readonly number[];
      /** The decoded sample packs the program uses: loaded before the first sample. */
      readonly samplePacks: readonly SamplePackData[];
      /** Null on the first video job of the page: the worker probes. */
      readonly probed: ProbedCodecs | null;
    }
  | { readonly type: "cancel"; readonly jobId: number }
  /** The device probe: about 1 s per tier, answered by "probed". */
  | { readonly type: "probe"; readonly jobId: number };

/**
 * NO_VIDEO_CODEC: no H.264 encoder here, hardware or software (never a VP9 file instead).
 * ENCODER_BUSY: the encoder only missed its probe deadlines; nothing is kept, Render can retry.
 * TAKE_INVALID: the take was refused or does not replay; its detail is a code, never the music's text.
 */
export type ExportFailure = "NO_VIDEO_CODEC" | "NO_AUDIO_CODEC" | "ENCODER_BUSY" | "RENDERER" | "OUT_OF_MEMORY" | "ENCODER" | "TAKE_INVALID" | "INTERNAL";

export type ExportWorkerToMain =
  | { readonly type: "progress"; readonly jobId: number; readonly done: number; readonly total: number }
  | {
      readonly type: "done";
      readonly jobId: number;
      readonly blob: Blob;
      readonly mimeType: string;
      readonly extension: "mp4" | "wav";
      readonly codecs: string;
      /** What a video job used; null for the WAV. */
      readonly probed: ProbedCodecs | null;
      readonly renderMs: number;
      /**
       * Of renderMs, what the codec probe's retries took on a busy machine (codec-probe.ts);
       * 0 when its first attempts encoded, for the WAV and on a kept probe. The render
       * budget is renderMs minus this.
       */
      readonly codecRetryMs: number;
      /** Samples per channel handed to the audio encoder or written to the WAV. */
      readonly audioSamples: number;
      readonly counters: DspCounters;
      /** How the video's light was encoded; null for the WAV and under constant bitrate. */
      readonly rateControl: RateControlReport | null;
    }
  | { readonly type: "probed"; readonly jobId: number; readonly probe: DeviceProbe }
  | { readonly type: "failed"; readonly jobId: number; readonly reason: ExportFailure; readonly detail: string }
  | { readonly type: "cancelled"; readonly jobId: number };
