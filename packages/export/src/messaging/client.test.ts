// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { ExportClient, type ExportStartInput } from "./client";
import { AUDIO_CODECS, VIDEO_CODECS } from "../codecs/codecs";
import type { ExportWorkerToMain, MainToExportWorker, ProbedCodecs } from "./protocol";

class FakeWorker {
  readonly sent: MainToExportWorker[] = [];
  readonly transfers: (readonly Transferable[])[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<ExportWorkerToMain>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(message: MainToExportWorker, transfer: readonly Transferable[] = []): void {
    this.sent.push(message);
    this.transfers.push(transfer);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(message: ExportWorkerToMain): void {
    this.onmessage?.({ data: message } as MessageEvent<ExportWorkerToMain>);
  }
}

const PROBED: ProbedCodecs = { video: VIDEO_CODECS[0]!, audio: AUDIO_CODECS[0]!, audioDelay: 2_112 };
const input = { plan: {}, program: {}, module: {}, branding: null, instrumentHashes: [], title: null, songTitle: null } as unknown as ExportStartInput;

function done(jobId: number, probed: ProbedCodecs | null): ExportWorkerToMain {
  return {
    type: "done",
    jobId,
    blob: new Blob([]),
    mimeType: "video/mp4",
    extension: "mp4",
    codecs: "",
    probed,
    renderMs: 0,
    codecRetryMs: 0,
    audioSamples: 0,
    counters: { lateDrops: 0, queueDrops: 0, nanResets: 0 },
    rateControl: null,
  };
}

function setup() {
  const workers: FakeWorker[] = [];
  const client = new ExportClient("worker.js", () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  return { client, workers };
}

describe("ExportClient", () => {
  it("uses one worker per job and ends it when the job ends", () => {
    const { client, workers } = setup();
    const first = client.start(input);
    workers[0]!.reply(done(first, null));
    expect(workers[0]!.terminated).toBe(true);
    client.start(input);
    expect(workers).toHaveLength(2);
  });

  it("probes once per page: the first video job's codecs go to every later job", () => {
    const { client, workers } = setup();
    const first = client.start(input);
    expect(workers[0]!.sent[0]).toMatchObject({ type: "start", probed: null });
    workers[0]!.reply(done(first, PROBED));
    const second = client.start(input);
    expect(workers[1]!.sent[0]).toMatchObject({ type: "start", jobId: second, probed: PROBED });
    // A WAV reports no probe; the one kept stays.
    workers[1]!.reply(done(second, null));
    client.start(input);
    expect(workers[2]!.sent[0]).toMatchObject({ probed: PROBED });
  });

  it("a new start ends the running worker and reports the old job cancelled", () => {
    const { client, workers } = setup();
    const results: string[] = [];
    client.onResult((result) => results.push(`${result.type}:${result.jobId}`));
    const first = client.start(input);
    const second = client.start(input);
    expect(workers[0]!.terminated).toBe(true);
    workers[0]!.reply(done(first, PROBED)); // already queued: ignored
    workers[1]!.reply(done(second, null));
    expect(results).toEqual([`cancelled:${first}`, `done:${second}`]);
  });

  it("sends title: null for audio and transfers both title bitmaps when given", () => {
    const { client, workers } = setup();
    client.start(input);
    expect(workers[0]!.sent[0]).toMatchObject({ type: "start", title: null, songTitle: null });
    expect(workers[0]!.transfers[0]).toEqual([]);
    const card = { width: 1080, height: 1920, label: "card" } as unknown as ImageBitmap;
    const caption = { width: 1080, height: 1920, label: "caption" } as unknown as ImageBitmap;
    client.start({ ...input, title: { card, caption }, songTitle: "Midnight Coast" });
    expect(workers[1]!.sent[0]).toMatchObject({ type: "start", title: { card, caption }, songTitle: "Midnight Coast" });
    expect(workers[1]!.transfers[0]).toEqual([card, caption]);
  });

  it("creates no worker until a job or a probe is asked for", () => {
    const { client, workers } = setup();
    client.onResult(() => undefined);
    client.onProgress(() => undefined);
    expect(workers).toHaveLength(0);
  });

  it("runs the device probe as a job of its own worker, ended with the answer or a cancel", () => {
    const { client, workers } = setup();
    const results: string[] = [];
    client.onResult((result) => results.push(result.type === "probed" ? `probed:${result.probe.tiers.length}` : result.type));
    const probe = client.probe();
    expect(workers[0]!.sent[0]).toEqual({ type: "probe", jobId: probe });
    workers[0]!.reply({ type: "probed", jobId: probe, probe: { tiers: [{ quality: "hd", isSupported: true, framesPerSecond: 60 }] } });
    expect(workers[0]!.terminated).toBe(true);
    client.probe();
    client.cancel();
    expect(workers[1]!.terminated).toBe(true);
    expect(results).toEqual(["probed:1", "cancelled"]);
  });
});
