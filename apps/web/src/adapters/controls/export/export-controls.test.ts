// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The sheet's work happens only on Render: opening it and changing a choice
// start nothing, the first Render of a device probes it, and a finished result stays while
// the music plays: the request is frozen when the job starts, so the live position moving
// on does not hide the file. A worker and a real plan are not needed here; the browser
// suite covers them.
import type { SamplePackData } from "@untzel/audio/protocol";
import type * as ExportModule from "@untzel/export";
import {
  PROBE_CACHE_KEY,
  brandLayout,
  chooseTiers,
  deviceKey,
  estimateRenderSeconds,
  exportCapSeconds,
  formatDuration,
  frameSize,
  isCompleteProbe,
  parseProbe,
  serializeProbe,
  type DeviceProbe,
  type ExportFailure,
  type ExportPlan,
  type ExportResult,
  type ExportStartInput,
} from "@untzel/export";
import type { Session, SessionView } from "@untzel/session";
import { fakeProgram, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it, vi } from "vitest";
import { DeviceProbeStore } from "./device-probe-store";
import { ExportControls } from "./export-controls";

type Listener = (view: SessionView) => void;
const TRAITS = { userAgent: "test", cores: 8, memoryGb: 8, screenWidth: 1440, screenHeight: 900, pixelRatio: 2 };
const FAST_DEVICE = { tiers: [{ quality: "hd" as const, isSupported: true, framesPerSecond: 120 }, { quality: "4k" as const, isSupported: true, framesPerSecond: 40 }] };

function fakeSession() {
  const listeners = new Set<Listener>();
  let bar = 4;
  let sourceHash = 1;
  let mode: "loop" | "song" = "loop";
  const program = { ...fakeProgram([fakeTrack("kick")], { tempo: 120 }), loopBars: 8 };
  const view = () =>
    ({ mode, playing: true, position: { bar, patternBar: bar }, song: { parts: [{ section: "a", bars: 8 }] }, title: "Night Drive", tempo: 124, key: null }) as unknown as SessionView;
  const session = {
    // A real program, so the stretch has a ruler: an 8-bar loop at 120 BPM (2 s a bar).
    state: () => ({ program: { ...program, sourceHash } }),
    view,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as Session;
  const emit = () => listeners.forEach((listener) => listener(view()));
  return {
    session,
    nextBar: () => ((bar += 1), emit()),
    edit: () => ((sourceHash += 1), emit()),
    setMode: (next: "loop" | "song") => ((mode = next), emit()),
  };
}

function fakeApi() {
  const started: ExportStartInput[] = [];
  const probes: number[] = [];
  const workers = { created: 0 };
  let finish: ((result: ExportResult) => void) | null = null;
  class FakeClient {
    constructor() {
      workers.created += 1;
    }
    onProgress() {
      return () => undefined;
    }
    onResult(listener: (result: ExportResult) => void) {
      finish = listener;
      return () => undefined;
    }
    start(input: ExportStartInput) {
      started.push(input);
      return 100 + started.length;
    }
    probe() {
      probes.push(probes.length + 1);
      return probes.length;
    }
    cancel() {}
    dispose() {}
  }
  const api = {
    planExport: (_program: unknown, request: { format: string; quality: "hd" | "4k"; mode: string; position: { patternBar: number } | null }) => ({
      ok: true,
      plan: {
        format: request.format,
        quality: request.quality,
        source: { kind: "program", mode: request.mode, startBar: request.position?.patternBar ?? 0, startTick: (request.position?.patternBar ?? 0) * 64, bars: 8 },
        totalVideoFrames: 510,
        frame: request.format === "audio" ? null : frameSize(request.format as "story", request.quality),
        origin: `from bar ${(request.position?.patternBar ?? 0) + 1} · 8 bars`,
      } as unknown as ExportPlan,
    }),
    planDurationLabel: () => "0:15 + 2 s",
    exportCapSeconds,
    formatDuration,
    prepareVideoBranding: async () => ({ ok: true, branding: { mark: { close() {} }, card: { close() {} } } }),
    prepareTitleOverlays: async () => ({ ok: true, overlays: { card: { close() {} }, caption: { close() {} } } }),
    chooseTiers,
    isCompleteProbe,
    frameSize,
    estimateRenderSeconds,
    brandLayout,
    PROBE_CACHE_KEY,
    deviceKey,
    parseProbe,
    serializeProbe,
    ExportClient: FakeClient,
  } as unknown as typeof ExportModule;
  const done = (jobId: number): void =>
    finish?.({
      type: "done",
      jobId,
      blob: new Blob([new Uint8Array(4)]),
      mimeType: "video/mp4",
      extension: "mp4",
      codecs: "avc1.640028, mp4a.40.2",
      probed: null,
      renderMs: 1,
      audioSamples: 1_600,
      counters: { lateDrops: 0, queueDrops: 0, nanResets: 0 },
    } as unknown as ExportResult);
  const probed = (jobId: number, probe: DeviceProbe = FAST_DEVICE): void => finish?.({ type: "probed", jobId, probe });
  const failed = (jobId: number, reason: ExportFailure): void => finish?.({ type: "failed", jobId, reason, detail: "" });
  return { api, started, probes, workers, done, probed, failed };
}

function controlsWith(
  session: Session,
  api: typeof ExportModule,
  probes = new DeviceProbeStore(null, TRAITS),
  samplePacks: () => Promise<readonly SamplePackData[]> = async () => [],
  announce: (message: string) => void = vi.fn(),
  sceneStill: (size: { readonly width: number; readonly height: number }) => Promise<Blob | null> = async () => null,
) {
  return new ExportControls({
    session,
    load: async () => api,
    module: async () => ({}) as WebAssembly.Module,
    instrumentHashes: [],
    samplePacks,
    workerUrl: "worker.js",
    logoUrl: "logo.svg",
    fonts: { load: async () => [], check: () => true },
    probes,
    reducedMotion: () => false,
    sceneStill,
    announce,
    internalError: vi.fn(),
    now: () => new Date(2026, 9, 3, 12, 0, 0),
    performanceNow: () => 0,
    untitled: () => "Untitled",
  });
}

async function settle(): Promise<void> {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

/** A device already probed: Render goes straight to the job. */
function probedStore(api: typeof ExportModule): DeviceProbeStore {
  const store = new DeviceProbeStore(null, TRAITS);
  store.write(api, FAST_DEVICE);
  return store;
}

describe("ExportControls", () => {
  it("opening the sheet and every choice start no worker and no render", async () => {
    const { session } = fakeSession();
    const { api, workers, started } = fakeApi();
    const controls = controlsWith(session, api);
    controls.openExport();
    await settle();
    controls.selectExportFormat("video");
    controls.selectExportQuality("hd");
    controls.setExportRangeMode("song");
    controls.setExportRange({ bars: 32 });
    await settle();
    expect([workers.created, started.length]).toEqual([0, 0]);
    const view = controls.view();
    expect(view.status).toBe("idle");
    expect(view.durations.video).toBe("0:15 + 2 s");
    expect(view.preview?.aspect).toBeCloseTo(16 / 9, 6);
  });

  it("the preview shows a still of the scene at the format's ratio, dropped on close", async () => {
    const { session } = fakeSession();
    const { api } = fakeApi();
    const asked: { width: number; height: number }[] = [];
    const controls = controlsWith(session, api, undefined, undefined, undefined, async (size) => {
      asked.push({ ...size });
      return new Blob([String(asked.length)], { type: "image/png" });
    });
    expect(controls.view().previewStill).toBeNull();
    controls.openExport();
    await settle();
    const story = controls.view().previewStill;
    expect(story).toMatch(/^blob:/);
    controls.selectExportFormat("video");
    // Until the video's still arrives, the story's is not shown in the video's frame.
    expect(controls.view().previewStill).toBeNull();
    await settle();
    expect(controls.view().previewStill).toMatch(/^blob:/);
    expect(controls.view().previewStill).not.toBe(story);
    controls.selectExportFormat("audio");
    await settle();
    expect(controls.view().previewStill).toBeNull();
    expect(asked).toEqual([{ width: 432, height: 768 }, { width: 768, height: 432 }]);
    controls.closeExport();
    expect(controls.view().previewStill).toBeNull();
  });

  it("offers HD and 4K before the first probe; the first Render probes, keeps it, then renders", async () => {
    const { session } = fakeSession();
    const { api, started, probes, probed } = fakeApi();
    const controls = controlsWith(session, api);
    controls.openExport();
    await settle();
    expect(controls.view().qualities.map((option) => option.quality)).toEqual(["hd", "4k"]);
    expect(controls.view().qualityNote).toBe("Render checks this device first. If it cannot take 4K, it renders HD.");
    controls.renderExport();
    // Starting, before the probe reaches the worker: no "Rendering · 0%" flash.
    expect(controls.view().status).toBe("checking");
    await settle();
    expect([probes.length, started.length]).toEqual([1, 0]);
    expect(controls.view().status).toBe("checking");
    probed(1);
    await settle();
    expect(started).toHaveLength(1);
    expect(started[0]?.plan.quality).toBe("hd");
    // The probe passed 4K: it is offered now, with the measured time; the render asked stays HD.
    const view = controls.view();
    expect(view.qualities.map((option) => [option.quality, option.resolution])).toEqual([
      ["hd", "1080 × 1920"],
      ["4k", "2160 × 3840"],
    ]);
    expect(view.qualities[1]?.estimate).toBe("about 13 s to render");
    expect(view.qualityNote).toBeNull();
  });

  it("keeps the story it rendered while the music moves on, with the bar it started from", async () => {
    const fake = fakeSession();
    const { api, started, done } = fakeApi();
    const controls = controlsWith(fake.session, api, probedStore(api));
    controls.openExport();
    controls.selectExportQuality("hd");
    controls.renderExport();
    await settle();
    expect(started).toHaveLength(1);
    fake.nextBar();
    done(101);
    fake.nextBar();
    fake.nextBar();
    const view = controls.view();
    expect(view.status).toBe("done");
    expect(view.result?.label).toMatch(/^Ready · 0:15 \+ 2 s · MP4 · 1080 × 1920 · /);
    expect(view.result?.url).toMatch(/^blob:/);
    expect(view.origin).toBe("from bar 5 · 8 bars");
    expect(controls.currentFile()).not.toBeNull();
    expect(started).toHaveLength(1);
    controls.closeExport();
  });

  it("adds the encoder's start to the estimate until a video render finishes on the page", async () => {
    const { session } = fakeSession();
    const { api, done } = fakeApi();
    const controls = controlsWith(session, api, probedStore(api));
    controls.openExport();
    await settle();
    // 510 frames at 120 frames/s: 4.25 s, plus 2 s while no encoder has run here.
    expect(controls.view().qualities[0]?.estimate).toBe("about 6 s to render");
    controls.renderExport();
    await settle();
    done(101);
    expect(controls.view().qualities[0]?.estimate).toBe("about 4 s to render");
  });

  it("a new text during a render cancels it: nothing starts until Render again", async () => {
    const fake = fakeSession();
    const { api, started } = fakeApi();
    const controls = controlsWith(fake.session, api, probedStore(api));
    controls.openExport();
    controls.renderExport();
    await settle();
    expect(controls.view().status).toBe("rendering");
    fake.edit();
    await settle();
    expect(started).toHaveLength(1);
    expect(controls.view().status).toBe("idle");
    controls.renderExport();
    await settle();
    expect(started).toHaveLength(2);
  });

  it("a different choice hides the file and asks for Render; going back shows it again", async () => {
    const fake = fakeSession();
    const { api, started, done } = fakeApi();
    const controls = controlsWith(fake.session, api, probedStore(api));
    controls.openExport();
    controls.selectExportQuality("hd");
    controls.renderExport();
    await settle();
    done(101);
    expect(controls.view().status).toBe("done");
    controls.selectExportQuality("4k");
    expect(controls.view().status).toBe("idle");
    controls.selectExportQuality("hd");
    expect(controls.view().status).toBe("done");
    expect(started).toHaveLength(1);
    controls.closeExport();
  });

  it("defaults to the highest tier the device renders at real time, never lowers a choice", async () => {
    const { session } = fakeSession();
    const { api } = fakeApi();
    const controls = controlsWith(session, api, probedStore(api));
    controls.openExport();
    await settle();
    expect(controls.view().quality).toBe("4k");
    controls.selectExportQuality("hd");
    expect(controls.view().quality).toBe("hd");
  });

  it("waits for the sample packs of the program and hands them to the worker", async () => {
    const { session } = fakeSession();
    const { api, started } = fakeApi();
    const pack: SamplePackData = { instrumentId: 3, sampleRate: 48_000, pcm: new Int16Array(8), zones: new Float64Array(8) };
    let ready: (packs: readonly SamplePackData[]) => void = () => undefined;
    const controls = controlsWith(session, api, probedStore(api), () => new Promise((resolve) => (ready = resolve)));
    controls.openExport();
    controls.renderExport();
    await settle();
    expect(started).toHaveLength(0);
    expect(controls.view().status).toBe("rendering");
    ready([pack]);
    await settle();
    expect(started).toHaveLength(1);
    expect(started[0]?.samplePacks).toEqual([pack]);
  });

  it("does not keep a device probe that missed a deadline: the next Render probes again", async () => {
    const { session } = fakeSession();
    const { api, probes, probed, done } = fakeApi();
    const controls = controlsWith(session, api);
    controls.openExport();
    controls.renderExport();
    await settle();
    probed(1, { tiers: [{ quality: "hd", isSupported: true, framesPerSecond: null }, { quality: "4k", isSupported: true, framesPerSecond: null }] });
    await settle();
    expect(controls.view().qualityNote).toBe("Render checks this device first. If it cannot take 4K, it renders HD.");
    done(101);
    controls.selectExportFormat("video");
    controls.renderExport();
    await settle();
    expect(probes).toHaveLength(2);
  });

  it("without H.264 the sheet says so, offers no video and no retry; Audio still renders", async () => {
    const { session } = fakeSession();
    const { api, started, failed } = fakeApi();
    const controls = controlsWith(session, api, probedStore(api));
    controls.openExport();
    controls.renderExport();
    await settle();
    failed(101, "NO_VIDEO_CODEC");
    const view = controls.view();
    expect(view.status).toBe("failed");
    expect(view.message).toBe("This device can't encode H.264 video. Try the Audio WAV export or another browser.");
    expect(view.isVideoUnavailable).toBe(true);
    expect(view.result).toBeNull();
    controls.selectExportFormat("video");
    expect(controls.view().format).toBe("story");
    controls.selectExportFormat("audio");
    controls.renderExport();
    await settle();
    expect(started.map((input) => input.plan.format)).toEqual(["story", "audio"]);
  });

  it("a busy encoder is not a missing one: the message asks to try again and video stays", async () => {
    const { session } = fakeSession();
    const { api, failed } = fakeApi();
    const controls = controlsWith(session, api, probedStore(api));
    controls.openExport();
    controls.renderExport();
    await settle();
    failed(101, "ENCODER_BUSY");
    expect(controls.view()).toMatchObject({ status: "failed", message: "The video encoder didn't answer in time. Try Render again.", isVideoUnavailable: false });
  });

  it("cancel leaves the sheet idle", async () => {
    const { session } = fakeSession();
    const { api } = fakeApi();
    const controls = controlsWith(session, api, probedStore(api));
    controls.openExport();
    controls.renderExport();
    await settle();
    controls.cancelExport();
    expect(controls.view().status).toBe("idle");
  });

  it("follows a play range by default and leaves it when Loop or Song is picked", async () => {
    const { session } = fakeSession();
    const { api, started } = fakeApi();
    const planned = vi.spyOn(api, "planExport");
    const controls = controlsWith(session, api, probedStore(api));
    controls.openExport();
    controls.selectExportFormat("video");
    controls.followPlayRange({ mode: "loop", startBar: 9, endBar: 28, label: "Bars 9–28" });
    controls.renderExport();
    await settle();
    expect(started).toHaveLength(1);
    // Bars 9–28 on an 8-bar loop: cut to the ruler, bars 8 (sic: the last bar) and on.
    expect(planned.mock.calls.at(-1)?.[1]).toMatchObject({ format: "video", range: { kind: "span", startTick: 448, endTick: 512 } });
    controls.setExportRangeMode("loop");
    expect(controls.view()).toMatchObject({ isPlayRangeChosen: false });
    expect(planned.mock.calls.at(-1)?.[1]).toMatchObject({ range: { kind: "bars", bars: 16 } });
    controls.useSelectedRange();
    controls.selectExportFormat("story");
    expect(controls.view().isPlayRangeChosen).toBe(true);
    expect(planned.mock.calls.at(-1)?.[1]).toMatchObject({ format: "story", mode: "loop", range: { kind: "span", startTick: 448, endTick: 512 } });
  });
  it("edits its own stretch by steps, caps it per format, and says it once on release", async () => {
    const { session } = fakeSession();
    const { api } = fakeApi();
    const said: string[] = [];
    const controls = controlsWith(session, api, probedStore(api), undefined, (message) => said.push(message));
    controls.openExport();
    await settle();
    controls.followPlayRange({ mode: "loop", startBar: 3, endBar: 6, label: "Bars 3–6" });
    expect(controls.view().stretch).toMatchObject({ startTick: 128, endTick: 384, isReset: true, hasPlayRange: true });
    controls.setExportStretch(168, 384, "drag");
    controls.setExportStretch(168, 384, "release");
    expect(controls.view().stretch).toMatchObject({ startTick: 168, endTick: 384, isReset: false });
    expect(said.filter((line) => line.startsWith("Export from"))).toEqual(["Export from 0:05.3 to 0:12.0."]);
    controls.setExportStretch(0, 64, "key");
    expect(said.filter((line) => line.startsWith("Export from"))).toHaveLength(1);
    controls.useExportPlayRange();
    expect(controls.view().stretch).toMatchObject({ startTick: 128, endTick: 384, isReset: true });
    controls.setExportFine(true);
    expect(controls.view().stretch?.isFine).toBe(true);
    // The Story's cap is 1:00, more than the 16 s loop: nothing to trim here.
    controls.selectExportFormat("story");
    expect(controls.view().stretch?.capSeconds).toBe(60);
  });
});
