// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export worker: one job at a time, off the main thread and off the live sound. The
// live worklet and transport worker keep their own WASM instance; nothing here can stop
// or change what plays.
import type { KeepOut } from "@untzel/scene";
import { LightCueMapper, createOfflineStage, deliverActivation, deliverBatch } from "@untzel/light/offline";
import { exportKeepOut } from "./brand/brand-exclusion";
import { isVideoFrameSize } from "./brand/branding";
import { chooseCodecs, webCodecsProbe, type ProbeTiming } from "./codecs/codec-probe";
import { warmUpVideoEncoder } from "./video/encoder-warm-up";
import { probeDevice } from "./probe/device-probe";
import { measureEncoderDelay } from "./audio/priming";
import type { ExportWorkerOptions } from "./ports";
import type { ExportFailure, ExportWorkerToMain, MainToExportWorker, ProbedCodecs } from "./messaging/protocol";
import { ExportAudio, programTimeline, type ExportTimeline } from "./audio/render-audio";
import { MP4_MIME, renderVideo } from "./video/render-video";
import { renderWav } from "./audio/render-wav";
import { guardTakeTimeline, takeLoadFailure } from "./take-timeline-guard";
import type { FrameSize } from "./probe/tiers";
import { WAV_MIME } from "./audio/wav";

/** What the worker uses of its global scope; DedicatedWorkerGlobalScope satisfies it. */
export interface ExportScope {
  postMessage(message: ExportWorkerToMain): void;
  onmessage: ((event: MessageEvent<MainToExportWorker>) => void) | null;
}

type StartMessage = Extract<MainToExportWorker, { readonly type: "start" }>;
type ProbeMessage = Extract<MainToExportWorker, { readonly type: "probe" }>;

class JobFailure extends Error {
  readonly reason: ExportFailure;
  constructor(reason: ExportFailure, detail: string) {
    super(detail);
    this.reason = reason;
  }
}

export function startExportWorker(scope: ExportScope, options: ExportWorkerOptions): void {
  let current: { readonly jobId: number; cancelled: boolean } | null = null;
  scope.onmessage = (event) => {
    const message = event.data;
    if (message.type === "cancel") {
      if (current?.jobId === message.jobId) current.cancelled = true;
      return;
    }
    if (current !== null) current.cancelled = true;
    const job = { jobId: message.jobId, cancelled: false };
    current = job;
    const run = message.type === "probe" ? runProbe(scope, message) : runJob(scope, options, message, () => job.cancelled);
    void run.finally(() => {
      if (current === job) current = null;
    });
  };
}

/** The device probe; the page keeps the answer and decides the tiers from it. */
async function runProbe(scope: ExportScope, message: ProbeMessage): Promise<void> {
  try {
    scope.postMessage({ type: "probed", jobId: message.jobId, probe: await probeDevice() });
  } catch (error) {
    const failure = classify(error, "INTERNAL");
    scope.postMessage({ type: "failed", jobId: message.jobId, reason: failure.reason, detail: failure.message });
  }
}

// Over 40 lines: the export job's steps in their order (setup, the audio or the video render, the result, the transfers closed); a split would move an await of the export's hot path.
async function runJob(
  scope: ExportScope,
  options: ExportWorkerOptions,
  message: StartMessage,
  isCancelled: () => boolean,
): Promise<void> {
  const { jobId, plan } = message;
  const started = performance.now();
  const onProgress = (done: number, total: number) => scope.postMessage({ type: "progress", jobId, done, total });
  // The first video job of the page starts the encoder now, beside the sound's setup and
  // the codec probe; later jobs find it warm.
  const warmUp = plan.frame !== null && message.probed === null ? warmUpVideoEncoder(plan.frame) : Promise.resolve(false);
  try {
    // The same zones the page hands its stage: the video keeps the screen's dark regions.
    // A file has no top bar: the sky's atmosphere may light the band the page gives its chrome.
    const keepOut = exportKeepOut();
    const mapper = new LightCueMapper(options.registry, keepOut);
    const stage = plan.frame === null ? null : prepareStage(plan.frame, plan.reducedMotion, keepOut);
    const audio = createAudio(options, message, await timelineOf(options, message), {
      onActivation: (activation) => {
        if (stage !== null) deliverActivation(stage.stage, mapper.activate(activation, plan.sampleRate));
      },
      onBatch: (batch) => {
        if (stage !== null) deliverBatch(stage.stage, mapper.cues(batch, plan.sampleRate));
      },
    });
    if (plan.format === "audio") {
      const result = await renderWav({ plan, audio, songTitle: message.songTitle, onProgress, isCancelled });
      if (result.kind === "cancelled") return scope.postMessage({ type: "cancelled", jobId });
      return scope.postMessage({
        type: "done",
        jobId,
        blob: result.blob,
        mimeType: WAV_MIME,
        extension: "wav",
        codecs: "pcm-s24",
        probed: null,
        renderMs: performance.now() - started,
        codecRetryMs: 0,
        audioSamples: result.frames,
        counters: audio.counters(),
        rateControl: null,
      });
    }
    if (stage === null || plan.frame === null) throw new JobFailure("RENDERER", "no stage");
    // The mark and the card are the attribution the CPAL requires: no video without both.
    const { mark, card, title } = message;
    if (mark === null || card === null || !isVideoFrameSize(mark, plan.frame) || !isVideoFrameSize(card, plan.frame)) {
      throw new JobFailure("INTERNAL", `a video job needs the ${plan.frame.width} × ${plan.frame.height} brand mark and closing card`);
    }
    if (title !== null && (!isVideoFrameSize(title.card, plan.frame) || !isVideoFrameSize(title.caption, plan.frame))) {
      throw new JobFailure("INTERNAL", `a title card and caption must be ${plan.frame.width} × ${plan.frame.height}`);
    }
    const [{ probed, retryMs }] = await Promise.all([message.probed === null ? probeCodecs(warmUp) : { probed: message.probed, retryMs: 0 }, warmUp]);
    const result = await renderVideo({
      plan,
      audio,
      stage: stage.stage,
      canvas: stage.canvas,
      branding: { mark, card },
      title,
      songTitle: message.songTitle,
      video: probed.video,
      sound: probed.audio,
      audioDelay: probed.audioDelay ?? 0,
      onProgress,
      isCancelled,
    }).catch((error: unknown) => {
      throw classify(error, "ENCODER");
    });
    stage.stage.destroy();
    if (result.kind === "cancelled") return scope.postMessage({ type: "cancelled", jobId });
    scope.postMessage({
      type: "done",
      jobId,
      blob: result.blob,
      mimeType: MP4_MIME,
      extension: "mp4",
      codecs: `${probed.video.codec}, ${probed.audio.codec}`,
      probed,
      renderMs: performance.now() - started,
      codecRetryMs: retryMs,
      audioSamples: result.audioSamples,
      counters: audio.counters(),
      rateControl: result.rateControl,
    });
  } catch (error) {
    const failure = classify(error, "INTERNAL");
    scope.postMessage({ type: "failed", jobId, reason: failure.reason, detail: failure.message });
  } finally {
    message.mark?.close();
    message.card?.close();
    message.title?.card.close();
    message.title?.caption.close();
  }
}

const workerTiming: ProbeTiming = {
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => performance.now(),
};

/**
 * The first video job of a page: which codecs really encode (H.264 always, codec-rule.ts),
 * and the AAC/Opus delay. A failure is thrown and nothing is kept: the next Render probes again.
 */
async function probeCodecs(warmUp: Promise<boolean>): Promise<{ readonly probed: ProbedCodecs; readonly retryMs: number }> {
  const codecs = await chooseCodecs({ probe: webCodecsProbe, timing: workerTiming, warmUp });
  if (!codecs.ok) {
    console.info(`export: ${codecs.reason} (${codecs.tried.join(", ")})`);
    throw new JobFailure(codecs.reason, codecs.tried.join(", "));
  }
  if (codecs.retryMs > 0) console.info(`export: the codec probe retried for ${Math.round(codecs.retryMs)} ms (${codecs.tried.join(", ")})`);
  const audioDelay = await measureEncoderDelay(codecs.audio);
  if (audioDelay === null) console.warn(`export: encoder delay of ${codecs.audio.codec} not measured; using 0`);
  return { probed: { video: codecs.video, audio: codecs.audio, audioDelay }, retryMs: codecs.retryMs };
}

/** The light at the file's own size: 4K is drawn at 4K, never scaled up. */
function prepareStage(frame: FrameSize, reducedMotion: boolean, keepOut: KeepOut) {
  const canvas = new OffscreenCanvas(frame.width, frame.height);
  const stage = createOfflineStage({ canvas, reducedMotion, keepOut });
  if (stage === null) {
    console.warn("export: neither WebGL2 nor 2D is available in the worker");
    throw new JobFailure("RENDERER", "no WebGL2 and no 2D context");
  }
  return { canvas, stage };
}

/** A program plays from its plan; a take's timeline comes from the composition's lazy chunk. */
async function timelineOf(options: ExportWorkerOptions, message: StartMessage): Promise<ExportTimeline> {
  const { source } = message;
  if (source.kind === "program") return programTimeline(message.plan, source.program, options.createTransport);
  const load = options.loadTakeTimeline;
  if (load === undefined) throw takeFailure("NO_TAKE_RENDERER");
  const timeline = await load(source.take).catch((error: unknown) => {
    throw classify(takeLoadFailure(error, takeFailure), "INTERNAL");
  });
  return guardTakeTimeline(timeline, takeFailure);
}

/** The code goes to the console and the page; the music's text never does. */
function takeFailure(code: string): JobFailure {
  console.warn("export: take", code);
  return new JobFailure("TAKE_INVALID", code);
}

function createAudio(
  options: ExportWorkerOptions,
  message: StartMessage,
  timeline: ExportTimeline,
  light: Pick<ConstructorParameters<typeof ExportAudio>[0], "onActivation" | "onBatch">,
): ExportAudio {
  return new ExportAudio({
    plan: message.plan,
    module: message.module,
    instruments: options.instruments,
    instrumentHashes: message.instrumentHashes,
    samplePacks: message.samplePacks,
    timeline,
    ...light,
  });
}

function classify(error: unknown, fallback: ExportFailure): JobFailure {
  if (error instanceof JobFailure) return error;
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  const detail = error instanceof Error ? error.message : String(error);
  if (name === "RangeError" || name === "QuotaExceededError") {
    console.warn(`export: out of memory (${detail})`);
    return new JobFailure("OUT_OF_MEMORY", detail);
  }
  if (name === "EncodingError") return new JobFailure("ENCODER", detail);
  return new JobFailure(fallback, detail);
}
