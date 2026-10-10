// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// `pnpm test:browser --measure`:
//   export-while-playing: an HD story, an HD ~60 s video and a 4K ~60 s video (the probe
//     seeded as a device that passed 4K) rendered while the onboard plays live;
//     the live sound must not underrun and its worklet counters stay at 0. Peak memory and
//     the load average go to .cache/measurements/export-while-playing.json.
//   export-long: a video and a WAV of a 6-minute song at HD, the song playing live.
//   export-long-4k: a 4K video of a 4:15 song, near the 4K cap of the plan (maxSecondsFor),
//     the song playing live; the worst case of the in-memory muxer.
//   Both long ones write duration, size, time, underruns, the live counters, the load and
//   the peak memory to .cache/measurements/export-long[-4k].json: page heap by
//   Performance.getMetrics, worker heap by Runtime.getHeapUsage through the worker's
//   target, and the resident size of this Chrome's renderer, GPU and browser processes (ps). A
//   crashed tab or a failed render is written down before the test fails.
import { execFileSync } from "node:child_process";
import { loadavg } from "node:os";
import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { chooseQuality, openExport, seedDeviceProbe } from "../support/export-support";
import { measurementSuite, read, writeMeasurement, type Reading } from "../support/measure-support";
import { PHASE1_ONBOARD_PATH, applyText, startEngine } from "../support/share-support";
import { VIEWPORTS } from "../../../support/support";

measurementSuite("independent");

const READY = /^Ready · /;
const SAMPLE_EVERY_MS = 250;

interface RenderOutcome {
  readonly ms: number;
  readonly label: string;
  /** The sheet's failure words; null when it got to Ready. */
  readonly failure: string | null;
}

/** Renders one format and waits until the sheet is Ready or says why it failed. */
async function renderFormat(page: Page, format: RegExp, setup?: () => Promise<void>): Promise<RenderOutcome> {
  const sheet = page.locator("#ui-export");
  await sheet.getByRole("button", { name: format }).click();
  const started = Date.now();
  await setup?.();
  await sheet.getByRole("button", { name: "Render", exact: true }).click();
  const status = sheet.locator(".ui-export__status");
  // The alert is always in the page, empty without a failure.
  const message = sheet.locator(".ui-export__message:not(:empty)");
  await expect
    .poll(async () => READY.test((await status.textContent()) ?? "") || (await message.count()) > 0, { timeout: 900_000, intervals: [500] })
    .toBe(true);
  const failure = (await message.count()) > 0 ? await message.textContent() : null;
  return { ms: Date.now() - started, label: (await status.textContent()) ?? "", failure };
}

/** A song of kick, hat and bass at 132 BPM: 24 tracks, `sections` sections of `barsPerSection` bars. */
function longSong(sections: number, barsPerSection: number): string {
  const lines = ["tempo 132", "key c minor"];
  const patterns = ["x... x... x... x...", "..x. ..x. ..x. ..xx", "c1 . . c1 . . c1 .", ". c2 . c2 . c2 . eb2"];
  const instruments = ["kick", "hat", "bass", "bass"];
  const tracks: string[] = [];
  for (let index = 0; index < 24; index += 1) {
    const kind = index % 4;
    const name = `t${index + 1}`;
    tracks.push(name);
    lines.push(`${name}: ${instruments[kind]} ${patterns[kind]} | gain 0.3 | pan ${((index % 5) / 5 - 0.4).toFixed(1)}`);
  }
  const names = Array.from({ length: sections }, (_, index) => `s${index + 1}`);
  names.forEach((section, index) => lines.push(`section ${section} ${tracks.filter((_, track) => (track + index) % 3 !== 0).join(" ")}`));
  lines.push(`song ${names.map((section) => `${section} ${barsPerSection}`).join(", ")}`);
  return `${lines.join("\n")}\n`;
}

interface PeakMemory {
  readonly pageBytes: number;
  readonly workerBytes: number;
  /** Largest resident size of one renderer of this Chrome (the tab, its workers and worklet); null where ps could not tell. */
  readonly rendererRssBytes: number | null;
  readonly gpuRssBytes: number | null;
  /** The browser process, where Chrome keeps Blob data: the file's parts land there while it renders. */
  readonly browserRssBytes: number | null;
}

/** This Chrome's renderer and GPU process ids, from the browser's own process list. */
async function chromeProcesses(page: Page): Promise<{ renderers: number[]; gpu: number[]; browser: number[] } | null> {
  const browser = page.context().browser();
  if (browser === null) return null;
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { processInfo } = (await cdp.send("SystemInfo.getProcessInfo")) as { processInfo: { type: string; id: number }[] };
    return {
      renderers: processInfo.filter((info) => info.type === "renderer").map((info) => info.id),
      gpu: processInfo.filter((info) => info.type === "GPU").map((info) => info.id),
      browser: processInfo.filter((info) => info.type === "browser").map((info) => info.id),
    };
  } catch {
    return null;
  } finally {
    await cdp.detach().catch(() => undefined);
  }
}

/** Resident size in bytes per pid, from ps; pids that are gone are left out. */
function residentBytes(pids: readonly number[]): Map<number, number> {
  const sizes = new Map<number, number>();
  if (pids.length === 0) return sizes;
  try {
    const out = execFileSync("ps", ["-o", "pid=,rss=", "-p", pids.join(",")], { encoding: "utf8" });
    for (const line of out.trim().split("\n")) {
      const [pid, rss] = line.trim().split(/\s+/).map(Number);
      if (pid !== undefined && rss !== undefined && Number.isFinite(rss)) sizes.set(pid, rss * 1024);
    }
  } catch {
    // ps exits 1 when none of the pids exists any more.
  }
  return sizes;
}

/** Peak heap of the page and of the export worker through the CDP, and the processes' resident size, every 250 ms. */
async function memorySampler(page: Page): Promise<{ stop(): Promise<PeakMemory> }> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const processes = await chromeProcesses(page);
  let pageBytes = 0;
  let workerBytes = 0;
  let rendererRssBytes: number | null = null;
  let gpuRssBytes: number | null = null;
  let browserRssBytes: number | null = null;
  let id = 0;
  const pending = new Map<number, (value: { usedSize: number; backingStorageSize?: number }) => void>();
  cdp.on("Target.receivedMessageFromTarget", (event: { message: string }) => {
    const message = JSON.parse(event.message) as { id?: number; result?: { usedSize: number; backingStorageSize?: number } };
    if (message.id !== undefined && message.result !== undefined) pending.get(message.id)?.(message.result);
  });
  const sampleProcesses = (): void => {
    if (processes === null) return;
    const sizes = residentBytes([...processes.renderers, ...processes.gpu, ...processes.browser]);
    const largest = (pids: readonly number[]) => Math.max(0, ...pids.map((pid) => sizes.get(pid) ?? 0));
    if (processes.renderers.length > 0) rendererRssBytes = Math.max(rendererRssBytes ?? 0, largest(processes.renderers));
    if (processes.gpu.length > 0) gpuRssBytes = Math.max(gpuRssBytes ?? 0, largest(processes.gpu));
    if (processes.browser.length > 0) browserRssBytes = Math.max(browserRssBytes ?? 0, largest(processes.browser));
  };
  const sample = async (): Promise<void> => {
    sampleProcesses();
    const metrics = (await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
    pageBytes = Math.max(pageBytes, metrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0);
    const { targetInfos } = (await cdp.send("Target.getTargets")) as { targetInfos: { targetId: string; type: string; url: string }[] };
    for (const target of targetInfos.filter((info) => info.type === "worker" && info.url.includes("export.worker"))) {
      const { sessionId } = (await cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: false })) as { sessionId: string };
      id += 1;
      const answer = new Promise<{ usedSize: number; backingStorageSize?: number }>((resolve) => pending.set(id, resolve));
      await cdp.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method: "Runtime.getHeapUsage" }) });
      const heap = await Promise.race([answer, new Promise<null>((resolve) => setTimeout(() => resolve(null), 400))]);
      if (heap !== null) workerBytes = Math.max(workerBytes, heap.usedSize + (heap.backingStorageSize ?? 0));
      await cdp.send("Target.detachFromTarget", { sessionId }).catch(() => undefined);
    }
  };
  let running = true;
  const loop = (async () => {
    while (running) {
      await sample().catch(() => sampleProcesses());
      await new Promise((resolve) => setTimeout(resolve, SAMPLE_EVERY_MS));
    }
  })();
  return {
    async stop() {
      running = false;
      await loop;
      await cdp.detach().catch(() => undefined);
      return { pageBytes, workerBytes, rendererRssBytes, gpuRssBytes, browserRssBytes };
    },
  };
}

interface TimelinePoint {
  readonly seconds: number;
  readonly underruns: number | null;
  readonly status: string;
}

/** Once a second: the live sound's underruns beside the sheet's status, to see which phase of a render they fall in. */
function underrunTimeline(page: Page): { stop(): Promise<TimelinePoint[]> } {
  const started = Date.now();
  const points: TimelinePoint[] = [];
  let running = true;
  const loop = (async () => {
    while (running) {
      const point = await page
        .evaluate(() => ({
          underruns: (globalThis as unknown as { untzelTest: { underruns(): number | null } }).untzelTest.underruns(),
          status: document.querySelector("#ui-export .ui-export__status")?.textContent ?? "",
        }))
        .catch(() => null);
      if (point !== null) {
        const last = points.at(-1);
        // Only the changes, so the file stays readable: a new underrun count or a new status word.
        const word = point.status.replace(/\d+%$/, "");
        if (last === undefined || last.underruns !== point.underruns || last.status.replace(/\d+%$/, "") !== word) {
          points.push({ seconds: (Date.now() - started) / 1000, ...point });
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  })();
  return {
    async stop() {
      running = false;
      await loop;
      return points;
    },
  };
}

/** macOS swap in use, in bytes, from sysctl; null elsewhere. */
function swapUsedBytes(): number | null {
  try {
    const out = execFileSync("sysctl", ["-n", "vm.swapusage"], { encoding: "utf8" });
    const used = /used = ([\d.]+)M/.exec(out)?.[1];
    return used === undefined ? null : Number(used) * 1024 * 1024;
  } catch {
    return null;
  }
}

function liveCounters(reading: Reading): { lateDrops: number; queueDrops: number; nanResets: number } | null {
  if (reading.stats === null) return null;
  const { lateDrops, queueDrops, nanResets } = reading.stats;
  return { lateDrops, queueDrops, nanResets };
}

/** The file's size, the render's details, and its top-level boxes read from the Blob's headers (moov before mdat). */
function fileDetails(page: Page): Promise<{ size: number | null; details: unknown; boxes: string[] }> {
  return page.evaluate(async () => {
    const hooks = (globalThis as unknown as { untzelTest: { exportFile(): File | null; exportDetails(): unknown } }).untzelTest;
    const file = hooks.exportFile();
    const boxes: string[] = [];
    for (let position = 0; file !== null && position + 8 <= file.size; ) {
      const view = new DataView(await file.slice(position, position + 16).arrayBuffer());
      const short = view.getUint32(0);
      const length = short === 1 ? Number(view.getBigUint64(8)) : short === 0 ? file.size - position : short;
      boxes.push(String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7)));
      if (length < 8) break;
      position += length;
    }
    return { size: file?.size ?? null, details: hooks.exportDetails(), boxes };
  });
}

/** The onboard's engine, then `text` playing live in song mode; renders run beside it. */
async function playLongSong(page: Page, text: string, with4k: boolean): Promise<void> {
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await applyText(page, text);
  await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Song", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as { untzelTest: { session(): { mode: string | null } } }).untzelTest.session().mode), { timeout: 15_000 })
    .toBe("song");
  await seedDeviceProbe(page, with4k);
  await page.waitForTimeout(2_000);
}

/** Remembers when the tab's renderer crashed, for the measurement file. */
function crashWatch(page: Page): { readonly crashedAt: () => number | null } {
  let crashedAt: number | null = null;
  page.on("crash", () => void (crashedAt = Date.now()));
  return { crashedAt: () => crashedAt };
}

/** The render, or the crash, whichever comes first: a crashed tab ends the wait at once. */
async function renderOrCrash(page: Page, render: () => Promise<RenderOutcome>): Promise<RenderOutcome | { readonly crashed: true }> {
  const crashed = new Promise<{ readonly crashed: true }>((resolve) => page.once("crash", () => resolve({ crashed: true })));
  return Promise.race([render(), crashed]);
}

test("export-while-playing: the live sound keeps going while a story and a video render, at HD and at 4K", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, true);
  await page.waitForTimeout(2_000);
  const before = await read(page);
  const loadBefore = loadavg();
  const sheet = await openExport(page);
  const memory = await memorySampler(page);
  const thirtyTwoBars = async (): Promise<void> => void (await sheet.getByLabel("Bars").selectOption("32"));
  const story = await renderFormat(page, /^Story/, () => chooseQuality(sheet, "HD"));
  const video = await renderFormat(page, /^Video/, async () => {
    await chooseQuality(sheet, "HD");
    await thirtyTwoBars();
  });
  const afterHd = await read(page);
  const video4k = await renderFormat(page, /^Video/, async () => {
    await chooseQuality(sheet, "4K");
    await thirtyTwoBars();
  });
  const after = await read(page);
  const peakMemory = await memory.stop();
  const results = {
    story,
    video,
    video4k,
    peakMemory,
    loadBefore,
    loadAfter: loadavg(),
    underrunsAfterHd: afterHd.underruns,
    underrunsBefore: before.underruns,
    underrunsAfter: after.underruns,
    liveBefore: before.stats,
    liveAfter: liveCounters(after),
  };
  writeMeasurement("export-while-playing", results);
  expect(story.label).toMatch(/ · 1080 × 1920 · /);
  expect(video.label).toMatch(/ · 1920 × 1080 · /);
  expect(video4k.label).toMatch(/ · 3840 × 2160 · /);
  if (before.underruns !== null && after.underruns !== null) expect(after.underruns).toBe(before.underruns);
  expect(after.stats).toMatchObject({ lateDrops: 0, queueDrops: 0, nanResets: 0 });
});

interface LongRender {
  /** The measurement file's name. */
  readonly name: string;
  readonly song: string;
  readonly quality: "HD" | "4K";
  /** A WAV after the video, the same song. */
  readonly withAudio: boolean;
}

/**
 * The long render beside the song playing live: the video (and the WAV), the peak memory,
 * the underruns over time and the swap, written before any assertion so a failure keeps
 * its numbers. Returns what the test asserts on.
 */
async function measureLongRender(page: Page, render: LongRender) {
  const watch = crashWatch(page);
  await playLongSong(page, render.song, render.quality === "4K");
  const before = await read(page);
  const loadBefore = loadavg();
  const swapBefore = swapUsedBytes();
  const memory = await memorySampler(page);
  const timeline = underrunTimeline(page);
  const sheet = await openExport(page);
  const video = await renderOrCrash(page, () => renderFormat(page, /^Video/, () => chooseQuality(sheet, render.quality)));
  const common = async () => ({ peakMemory: await memory.stop(), underrunTimeline: await timeline.stop(), loadBefore, loadAfter: loadavg(), swapBefore, swapAfter: swapUsedBytes() });
  if ("crashed" in video) {
    writeMeasurement(render.name, { crashed: true, crashedAt: watch.crashedAt(), ...(await common()) });
    throw new Error(`${render.name}: the tab crashed during the ${render.quality} video render`);
  }
  const videoFile = video.failure === null ? await fileDetails(page) : null;
  const afterVideo = await read(page);
  const audio = render.withAudio && video.failure === null ? await renderFormat(page, /^Audio/) : null;
  const audioFile = audio === null ? null : await fileDetails(page);
  const after = await read(page);
  writeMeasurement(render.name, {
    video: { ...video, ...videoFile },
    audio: audio === null ? null : { ...audio, ...audioFile },
    ...(await common()),
    underrunsBefore: before.underruns,
    underrunsAfterVideo: afterVideo.underruns,
    underrunsAfter: after.underruns,
    liveAfter: liveCounters(after),
  });
  return { before, after, video, audio, boxes: videoFile?.boxes ?? [] };
}

test("export-long: video and WAV of a 6-minute song at HD, the song playing live", async ({ page }) => {
  test.setTimeout(1_200_000);
  // 8 sections of 24 bars: 192 bars, 5:49 at 132 BPM.
  const { before, after, video, audio, boxes } = await measureLongRender(page, { name: "export-long", song: longSong(8, 24), quality: "HD", withAudio: true });
  expect(video.failure).toBeNull();
  expect(boxes.slice(0, 2)).toEqual(["ftyp", "moov"]);
  expect(boxes.indexOf("moov")).toBeLessThan(boxes.indexOf("mdat"));
  expect(video.label).toMatch(/^Ready · 5:\d\d \+ 2 s · MP4 · 1920 × 1080 · /);
  expect(audio?.label).toMatch(/^Ready · 5:49 · WAV · /);
  if (before.underruns !== null && after.underruns !== null) expect(after.underruns).toBe(before.underruns);
  expect(after.stats).toMatchObject({ lateDrops: 0, queueDrops: 0, nanResets: 0 });
});

test("export-long-4k: a 4K video of a 4:15 song, near the 4K cap, the song playing live", async ({ page }) => {
  test.setTimeout(1_800_000);
  // 7 sections of 20 bars: 140 bars, 4:15 at 132 BPM, under maxSecondsFor("4k") − 2 s = 4:21.
  const { before, after, video, boxes } = await measureLongRender(page, { name: "export-long-4k", song: longSong(7, 20), quality: "4K", withAudio: false });
  expect(video.failure).toBeNull();
  expect(boxes.slice(0, 2)).toEqual(["ftyp", "moov"]);
  expect(boxes.indexOf("moov")).toBeLessThan(boxes.indexOf("mdat"));
  expect(video.label).toMatch(/^Ready · 4:1\d \+ 2 s · MP4 · 3840 × 2160 · /);
  if (before.underruns !== null && after.underruns !== null) expect(after.underruns).toBe(before.underruns);
  expect(after.stats).toMatchObject({ lateDrops: 0, queueDrops: 0, nanResets: 0 });
});
