// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// One export job at a time, from the request to the file: loads @untzel/export when the
// sheet opens (code only: no worker, no encoder), and on Render probes the device once
// (export-probe.ts), draws the pictures at the plan's frame size (export-pictures.ts),
// sends the frozen plan to the worker, follows its progress and turns its answer into a
// kept file or a failure message. The caller (export-controls.ts) decides what to render
// (export-render-request.ts).
import type { SamplePackData } from "@untzel/audio/protocol";
import type { Program } from "@untzel/core";
import type * as ExportModule from "@untzel/export";
import type { DeviceProbe, ExportClient, ExportPlan, ExportResult } from "@untzel/export";
import { canShareFiles, timestamp } from "@untzel/share";
import { announcements } from "../../../strings/copy";
import type { DeviceProbeStore } from "./device-probe-store";
import { failureMessage, readyLabel, secondsLeft } from "../export-sheet/export-labels";
import { closePictures, prepareExportPictures } from "./export-pictures";
import { afterProbe, startProbe, type ProbeJob } from "./export-probe";
import type { JobRequest, RenderRequest } from "./export-render-request";
import type { KeptFile } from "./kept-exports";

export type ExportApi = typeof ExportModule;

export interface ExportJobOptions {
  /** import("@untzel/export"), once. */
  readonly load: () => Promise<ExportApi>;
  readonly module: () => Promise<WebAssembly.Module>;
  readonly instrumentHashes: readonly number[];
  /** The decoded sample packs a program uses, once loaded: the export waits for them. */
  readonly samplePacks: (program: Program) => Promise<readonly SamplePackData[]>;
  /** The export worker's URL (?worker&url). */
  readonly workerUrl: string;
  readonly logoUrl: string;
  readonly fonts: Pick<FontFaceSet, "load" | "check">;
  readonly probes: DeviceProbeStore;
  readonly internalError: (error: unknown) => void;
  readonly now: () => Date;
  readonly performanceNow: () => number;
}

export type JobOutcome =
  | { readonly kind: "done"; readonly kept: KeptFile }
  | { readonly kind: "failed"; readonly message: string; readonly isVideoUnavailable: boolean };

export interface JobListener {
  /** Progress, start and end, the probe kept: the sheet re-renders. */
  readonly onChange: () => void;
  readonly onOutcome: (outcome: JobOutcome) => void;
}

/** The job in the worker: a render, or the device probe that runs before the first render of this device. */
type Running =
  | ProbeJob
  | {
      readonly jobId: number;
      readonly request: RenderRequest;
      readonly isProbe: false;
      readonly startedAt: number;
    };

export class ExportJobs {
  readonly #options: ExportJobOptions;
  readonly #listener: JobListener;
  #api: ExportApi | null = null;
  #loading: Promise<ExportApi> | null = null;
  #client: ExportClient | null = null;
  #running: Running | null = null;
  /** Between a start and its job reaching the worker (module, card): already rendering. */
  #isStarting = false;
  #progress: number | null = null;
  #secondsLeft: number | null = null;
  /** Bumped by every start and cancel, so a late card or module never starts an old job. */
  #generation = 0;
  /** A device probe or a video render finished on this page: the encoder's start is paid. */
  #isEncoderStarted = false;

  constructor(options: ExportJobOptions, listener: JobListener) {
    this.#options = options;
    this.#listener = listener;
  }

  /** Null until the sheet first opens and the module loads. */
  get api(): ExportApi | null {
    return this.#api;
  }

  get isRendering(): boolean {
    return this.#running !== null || this.#isStarting;
  }

  /** Started, and no job (probe or render) has reached the worker yet. */
  get isStarting(): boolean {
    return this.#isStarting && this.#running === null;
  }

  get isChecking(): boolean {
    return this.#running?.isProbe === true;
  }

  /** The frozen plan of the job in progress. */
  get runningPlan(): ExportPlan | null {
    return this.#running?.request.plan ?? null;
  }

  /** False until an encoder has run on this page; the estimate adds its start until then. */
  get isEncoderStarted(): boolean {
    return this.#isEncoderStarted;
  }

  get progress(): number | null {
    return this.#progress;
  }

  get secondsLeft(): number | null {
    return this.#secondsLeft;
  }

  /** The kept device probe; null before the module loads or before the first probe. */
  deviceProbe(): DeviceProbe | null {
    return this.#api === null ? null : this.#options.probes.read(this.#api);
  }

  /** The sheet opened: load the code that plans, nothing else. */
  prepare(): void {
    void this.#ensureApi().then(
      () => this.#listener.onChange(),
      (error: unknown) => this.#options.internalError(error),
    );
  }

  /** Cancels the job in progress; `request` decides, with the module loaded, what to render. */
  start(request: (api: ExportApi) => JobRequest): void {
    this.#stopRunning();
    this.#generation += 1;
    const generation = this.#generation;
    this.#isStarting = true;
    this.#listener.onChange();
    void this.#ensureApi()
      .then((api) => this.#begin(api, generation, request(api)))
      .catch((error: unknown) => this.#crashed(generation, error));
  }

  cancel(): void {
    this.#generation += 1;
    this.#isStarting = false;
    this.#stopRunning();
    this.#listener.onChange();
  }

  /** The client lives as long as the page, so its codec probe runs once per page load. */
  dispose(): void {
    this.cancel();
    this.#client?.dispose();
    this.#client = null;
  }

  async #begin(api: ExportApi, generation: number, request: JobRequest): Promise<void> {
    if (generation !== this.#generation) return;
    if (request.kind === "kept") return this.#settle();
    if (request.kind === "refused") return this.#finish({ kind: "failed", message: request.message, isVideoUnavailable: false });
    if (request.plan.frame !== null && this.#options.probes.read(api) === null) {
      this.#running = startProbe(this.#ensureClient(api), request, () => this.#options.performanceNow());
      return this.#settle();
    }
    await this.#render(api, generation, request);
  }

  async #render(api: ExportApi, generation: number, request: RenderRequest): Promise<void> {
    const { plan, program, title } = request;
    this.#isStarting = true;
    const pictures = await prepareExportPictures(api, this.#options.fonts, this.#options.logoUrl, plan, title);
    if (generation !== this.#generation) return closePictures(pictures ?? null);
    if (pictures === undefined) return this.#finish({ kind: "failed", message: announcements.exportNoVideo, isVideoUnavailable: false });
    const module = await this.#options.module();
    const samplePacks = await this.#options.samplePacks(program);
    if (generation !== this.#generation) return closePictures(pictures);
    this.#progress = 0;
    this.#secondsLeft = null;
    const jobId = this.#ensureClient(api).start({
      plan,
      source: { kind: "program", program },
      module,
      branding: pictures?.branding ?? null,
      title: pictures?.title ?? null,
      songTitle: title.text,
      instrumentHashes: this.#options.instrumentHashes,
      samplePacks,
    });
    this.#running = { jobId, request, isProbe: false, startedAt: this.#options.performanceNow() };
    this.#settle();
  }
  #ensureApi(): Promise<ExportApi> {
    if (this.#api !== null) return Promise.resolve(this.#api);
    this.#loading ??= this.#options.load().then((api) => {
      this.#api = api;
      return api;
    });
    return this.#loading;
  }

  #ensureClient(api: ExportApi): ExportClient {
    if (this.#client !== null) return this.#client;
    const client = new api.ExportClient(this.#options.workerUrl);
    client.onProgress((done, total) => this.#onProgress(done, total));
    client.onResult((result) => this.#onResult(result));
    this.#client = client;
    return client;
  }

  #onProgress(done: number, total: number): void {
    const running = this.#running;
    if (running === null || running.isProbe || total <= 0) return;
    this.#progress = Math.min(1, done / total);
    this.#secondsLeft = secondsLeft((this.#options.performanceNow() - running.startedAt) / 1000, done, total);
    this.#listener.onChange();
  }

  #onResult(result: ExportResult): void {
    const running = this.#running;
    if (running === null || result.jobId !== running.jobId) return;
    this.#running = null;
    this.#progress = null;
    this.#secondsLeft = null;
    if (result.type === "cancelled") return this.#listener.onChange();
    if (running.isProbe) return this.#afterProbe(running.request, result);
    if (result.type === "failed") return this.#onFailed(result);
    if (result.type !== "done") return this.#listener.onChange();
    this.#isEncoderStarted ||= running.request.plan.frame !== null;
    const { counters } = result;
    if (counters.lateDrops + counters.queueDrops + counters.nanResets > 0) console.warn("export: DSP counters", counters);
    this.#finish({ kind: "done", kept: this.#keptFrom(running.request, result) });
  }

  /** Kept for the device, then the render the person asked for; a failed probe still renders HD. */
  #afterProbe(request: RenderRequest, result: ExportResult): void {
    const api = this.#api;
    if (api === null) return;
    const chosen = afterProbe(api, this.#options.probes, request, result);
    // A probe ran the encoder: the estimate no longer adds its start.
    if (result.type === "probed") this.#isEncoderStarted = true;
    const generation = this.#generation;
    void this.#render(api, generation, chosen).catch((error: unknown) => this.#crashed(generation, error));
  }

  #onFailed(result: Extract<ExportResult, { type: "failed" }>): void {
    if (result.reason === "INTERNAL" || result.reason === "ENCODER") this.#options.internalError(new Error(result.detail));
    // No H.264 (or no audio codec): Story and Video go inert for the page, no MP4 is offered.
    // ENCODER_BUSY is only a busy machine: nothing is kept and Render stays available.
    const isVideoUnavailable = result.reason === "NO_VIDEO_CODEC" || result.reason === "NO_AUDIO_CODEC";
    this.#finish({ kind: "failed", message: failureMessage(result.reason), isVideoUnavailable });
  }

  #keptFrom(request: RenderRequest, result: Extract<ExportResult, { type: "done" }>): KeptFile {
    const { plan } = request;
    const name = `${request.title.fileStem}-${plan.format}-${timestamp(this.#options.now())}.${result.extension}`;
    const file = new File([result.blob], name, { type: result.mimeType });
    const { codecs, renderMs, codecRetryMs, audioSamples, counters, rateControl } = result;
    const label = this.#api === null ? "" : readyLabel(this.#api, plan, result.extension, file.size, codecs);
    const details = { codecs, renderMs, codecRetryMs, audioSamples, counters, rateControl };
    return { key: request.key, format: plan.format, plan, file, details, label, canShare: canShareFiles([file]) };
  }

  #crashed(generation: number, error: unknown): void {
    if (generation !== this.#generation) return;
    this.#options.internalError(error);
    this.#finish({ kind: "failed", message: announcements.exportFailed, isVideoUnavailable: false });
  }

  /** The job reached the worker (or there was nothing to do): no longer starting. */
  #settle(): void {
    this.#isStarting = false;
    this.#listener.onChange();
  }

  #finish(outcome: JobOutcome): void {
    this.#isStarting = false;
    this.#running = null;
    this.#progress = null;
    this.#listener.onOutcome(outcome);
  }

  #stopRunning(): void {
    if (this.#running === null) return;
    this.#running = null;
    this.#progress = null;
    this.#secondsLeft = null;
    this.#client?.cancel();
  }
}
