// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The page side of the export worker. One worker per job, ended when the job ends; a new
// start cancels the job before it, and messages of an old job are ignored. The codec
// probe of the first video job is kept and handed to every later one. The device probe
// is a job like a render: its own worker, cancelled the same way.
import type { SamplePackData } from "@untzel/audio/protocol";
import type { Unsubscribe } from "@untzel/session";
import type { VideoBranding } from "../brand/branding";
import type { ExportPlan } from "../plan";
import type { ExportSource, ExportWorkerToMain, MainToExportWorker, ProbedCodecs } from "./protocol";
import type { FrameTitle } from "../title/title-overlays";

export type ExportResult = Extract<ExportWorkerToMain, { type: "done" | "probed" | "failed" | "cancelled" }>;

export interface ExportStartInput {
  readonly plan: ExportPlan;
  readonly source: ExportSource;
  readonly module: WebAssembly.Module;
  /** From prepareVideoBranding; null for audio. Transferred: unusable on the page afterwards. */
  readonly branding: VideoBranding | null;
  readonly instrumentHashes: readonly number[];
  /** The decoded sample packs the program uses: the export renders with them from the first sample. */
  readonly samplePacks: readonly SamplePackData[];
  /** prepareTitleOverlays' card and caption, transferred; null for audio and untitled tests. */
  readonly title: FrameTitle | null;
  /** The song's title for the file's metadata; null without one. */
  readonly songTitle: string | null;
}

/** new Worker(url, { type: "module" }) by default; tests pass their own. */
export type WorkerFactory = (url: string) => Worker;

export class ExportClient {
  readonly #workerUrl: string;
  readonly #createWorker: WorkerFactory;
  readonly #progress = new Set<(done: number, total: number) => void>();
  readonly #results = new Set<(result: ExportResult) => void>();
  #worker: Worker | null = null;
  #jobId = 0;
  #running: number | null = null;
  #disposed = false;
  #probed: ProbedCodecs | null = null;

  /** `workerUrl` comes from the composition root (?worker&url). */
  constructor(workerUrl: string, createWorker: WorkerFactory = (url) => new Worker(url, { type: "module" })) {
    this.#workerUrl = workerUrl;
    this.#createWorker = createWorker;
  }

  /** Cancels the previous job, if any; returns the new job id. */
  start(input: ExportStartInput): number {
    const { branding, title, ...job } = input;
    const mark = branding?.mark ?? null;
    const card = branding?.card ?? null;
    const transfer = [mark, card, title?.card ?? null, title?.caption ?? null].filter((bitmap): bitmap is ImageBitmap => bitmap !== null);
    return this.#post((jobId) => ({ type: "start", jobId, ...job, mark, card, title, probed: this.#probed }), transfer);
  }

  /** The device probe as a job: the answer comes to onResult as "probed". */
  probe(): number {
    return this.#post((jobId) => ({ type: "probe", jobId }), []);
  }

  /** The worker is ended at once; the sound and the page do not wait for it. */
  cancel(): void {
    const jobId = this.#running;
    if (jobId === null) return;
    this.#running = null;
    this.#terminate();
    this.#emit({ type: "cancelled", jobId });
  }

  onProgress(listener: (done: number, total: number) => void): Unsubscribe {
    this.#progress.add(listener);
    return () => this.#progress.delete(listener);
  }

  onResult(listener: (result: ExportResult) => void): Unsubscribe {
    this.#results.add(listener);
    return () => this.#results.delete(listener);
  }

  /** Ends the worker; messages after this are ignored. */
  dispose(): void {
    this.#disposed = true;
    this.#running = null;
    this.#terminate();
    this.#progress.clear();
    this.#results.clear();
  }

  #post(message: (jobId: number) => MainToExportWorker, transfer: Transferable[]): number {
    this.cancel();
    this.#jobId += 1;
    const jobId = this.#jobId;
    this.#running = jobId;
    try {
      this.#ensureWorker().postMessage(message(jobId), transfer);
    } catch (error) {
      queueMicrotask(() => this.#finish({ type: "failed", jobId, reason: "INTERNAL", detail: String(error) }));
    }
    return jobId;
  }

  #ensureWorker(): Worker {
    if (this.#worker !== null) return this.#worker;
    const worker = this.#createWorker(this.#workerUrl);
    worker.onmessage = (event: MessageEvent<ExportWorkerToMain>) => this.#receive(event.data);
    worker.onerror = (event) => {
      event.preventDefault();
      const jobId = this.#running;
      if (jobId !== null) this.#finish({ type: "failed", jobId, reason: "INTERNAL", detail: event.message || "worker error" });
    };
    this.#worker = worker;
    return worker;
  }

  #receive(message: ExportWorkerToMain): void {
    if (this.#disposed || message.jobId !== this.#running) return;
    if (message.type === "progress") {
      for (const listener of this.#progress) listener(message.done, message.total);
      return;
    }
    this.#finish(message);
  }

  #finish(result: ExportResult): void {
    if (result.jobId !== this.#running) return;
    if (result.type === "done" && result.probed !== null) this.#probed = result.probed;
    this.#running = null;
    this.#terminate();
    this.#emit(result);
  }

  #emit(result: ExportResult): void {
    if (this.#disposed) return;
    for (const listener of this.#results) listener(result);
  }

  #terminate(): void {
    this.#worker?.terminate();
    this.#worker = null;
  }
}
