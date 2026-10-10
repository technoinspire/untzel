// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Export renders only on Render, on the real engine:
//   - with the sheet open, through every choice, no export worker and no encoder exist
//     (counted by a hook installed before the page's own scripts) and there is no
//     Download; Render probes this new device, renders with the music still playing,
//     and only then shows Download with the file as the preview;
//   - a text change during the render cancels it and the sheet goes back to Render;
//   - idle CPU and memory with the sheet open match the sheet closed (CDP metrics).
import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { openExport, renderExport } from "../support/export-support";
import { writeMeasurement } from "../support/measure-support";
import { PHASE1_ONBOARD_PATH, session, startEngine, stopMusic } from "../support/share-support";
import { VIEWPORTS, collectErrors, screenshot } from "../../../support/support";

interface Created {
  readonly workers: readonly string[];
  readonly videoEncoders: number;
  readonly audioEncoders: number;
  readonly configChecks: number;
}

/** Every Worker the page constructs, and every encoder made or asked about on the page. */
async function countCreated(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const created = { workers: [] as string[], videoEncoders: 0, audioEncoders: 0, configChecks: 0 };
    (globalThis as unknown as { untzelCreated: typeof created }).untzelCreated = created;
    const NativeWorker = globalThis.Worker;
    globalThis.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        created.workers.push(String(url));
      }
    };
    if (typeof globalThis.VideoEncoder === "function") {
      const NativeVideoEncoder = globalThis.VideoEncoder;
      const check = NativeVideoEncoder.isConfigSupported.bind(NativeVideoEncoder);
      globalThis.VideoEncoder = class extends NativeVideoEncoder {
        constructor(init: VideoEncoderInit) {
          super(init);
          created.videoEncoders += 1;
        }
        static override isConfigSupported(config: VideoEncoderConfig) {
          created.configChecks += 1;
          return check(config);
        }
      };
    }
    if (typeof globalThis.AudioEncoder === "function") {
      const NativeAudioEncoder = globalThis.AudioEncoder;
      globalThis.AudioEncoder = class extends NativeAudioEncoder {
        constructor(init: AudioEncoderInit) {
          super(init);
          created.audioEncoders += 1;
        }
      };
    }
  });
}

function created(page: Page): Promise<Created> {
  return page.evaluate(() => {
    const value = (globalThis as unknown as { untzelCreated: Created }).untzelCreated;
    return { ...value, workers: [...value.workers] };
  });
}

const exportWorkers = (value: Created) => value.workers.filter((url) => url.includes("export"));

test("opening Export starts no worker and no encoder; Download appears only after Render", async ({ page }) => {
  const errors = collectErrors(page);
  await countCreated(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  const before = await created(page);
  const sheet = await openExport(page);
  const download = sheet.getByRole("button", { name: "Download" });
  // Every choice the sheet offers, and time to settle: still nothing runs.
  for (const format of [/^Video/, /^Audio/, /^Story/]) {
    await sheet.getByRole("button", { name: format }).click();
    await expect(sheet.locator(".ui-export__status")).toHaveText(/ · not rendered$/);
    await expect(download).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Render", exact: true })).toBeVisible();
  }
  // HD and 4K show before the probe, and the note says a refused 4K renders HD.
  await expect(sheet.locator(".ui-export__note")).toHaveText("Render checks this device first. If it cannot take 4K, it renders HD.");
  await page.waitForTimeout(1_500);
  const open = await created(page);
  expect(exportWorkers(open), "export workers with the sheet open").toEqual([]);
  expect(open.workers, "no worker of any kind starts with the sheet").toEqual(before.workers);
  expect(open).toMatchObject({ videoEncoders: 0, audioEncoders: 0, configChecks: 0 });
  await screenshot(page, "export-idle", 390);

  // Every status, and whether Download showed with it, from Render to the file.
  await sheet.evaluate((root) => {
    const seen: { status: string; download: boolean; at: number }[] = [];
    (globalThis as unknown as { exportSeen: typeof seen }).exportSeen = seen;
    const note = () => {
      const status = root.querySelector(".ui-export__status")?.textContent ?? "";
      const button = [...root.querySelectorAll("button")].find((node) => node.textContent === "Download");
      seen.push({ status, download: button !== undefined && !button.hidden, at: performance.now() });
    };
    new MutationObserver(note).observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  });
  const started = Date.now();
  await sheet.getByRole("button", { name: "Render", exact: true }).click();
  // A new device: the probe runs first, then the render; Cancel all along, the music on.
  await expect(sheet.locator(".ui-export__status")).toHaveText(/^(Checking this device…|Rendering .* · \d+%)$/);
  await expect(sheet.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(sheet.locator(".ui-sheet__hint")).toHaveText("The music keeps playing while it renders.");
  await expect(sheet.locator(".ui-export__status")).toHaveText(/^Rendering .* · \d+%$/, { timeout: 30_000 });
  await screenshot(page, "export-rendering", 390);
  expect((await session(page)).playing, "the music keeps playing during the render").toBe(true);
  await expect(sheet.locator(".ui-export__status")).toHaveText(/^Ready · /, { timeout: 60_000 });
  const elapsed = Date.now() - started;
  await expect(download).toBeVisible();
  await expect(sheet.locator("video.ui-preview__player")).toHaveAttribute("src", /^blob:/);
  await screenshot(page, "export-done", 390);
  const seen = await page.evaluate(() => (globalThis as unknown as { exportSeen: { status: string; download: boolean; at: number }[] }).exportSeen);
  const early = seen.filter((entry) => entry.download && !entry.status.startsWith("Ready · "));
  expect(early, "Download before the file").toEqual([]);
  expect(seen.some((entry) => entry.status === "Checking this device…"), "the probe ran on this new device").toBe(true);
  const firstChecking = seen.findIndex((entry) => entry.status === "Checking this device…");
  const firstRendering = seen.findIndex((entry) => entry.status.startsWith("Rendering "));
  expect(firstRendering, "no Rendering flash before the probe").toBeGreaterThan(firstChecking);
  const checkingSeconds = ((seen[firstRendering]?.at ?? 0) - (seen[firstChecking]?.at ?? 0)) / 1000;
  const after = await created(page);
  expect(exportWorkers(after).length, "the probe's worker, then the render's").toBe(2);
  expect((await session(page)).playing).toBe(true);
  const probe = await page.evaluate(() => window.localStorage.getItem("untzel.export.device-probe"));
  expect(probe, "the probe is kept for this device").not.toBeNull();

  // Probed now: the sheet promises a time, and the next render keeps the promise (honest
  // estimate): within half to twice, plus a second for rounding.
  await sheet.getByRole("button", { name: /^Video/ }).click();
  const hd = sheet.getByRole("group", { name: "Quality" }).getByRole("button", { name: /^HD/ });
  await expect(hd).toHaveText(/about \d+ s to render$/);
  const estimateSeconds = Number(/about (\d+) s to render$/.exec((await hd.textContent()) ?? "")?.[1]);
  const videoSeconds = (await renderExport(page)) / 1000;
  writeMeasurement("export-test-render-only", { elapsedMs: elapsed, statuses: [...new Set(seen.map((entry) => entry.status))], probe: JSON.parse(probe ?? "null"), created: after, checkingSeconds, video: { estimateSeconds, videoSeconds } });
  expect(videoSeconds, `estimate ${estimateSeconds} s`).toBeLessThanOrEqual(estimateSeconds * 2 + 1);
  expect(videoSeconds, `estimate ${estimateSeconds} s`).toBeGreaterThanOrEqual(estimateSeconds / 2 - 1);
  expect(errors).toEqual([]);
});

test("a text change during the render cancels it and the sheet goes back to Render", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await stopMusic(page);
  const before = (await session(page)).source;
  const sheet = await openExport(page);
  await sheet.getByRole("button", { name: "Render", exact: true }).click();
  const status = sheet.locator(".ui-export__status");
  await expect(status).toHaveText(/^Rendering .* · \d+%$/, { timeout: 30_000 });
  // The desktop panel leaves the track table and its shortcuts active beside it.
  await sheet.getByRole("button", { name: "Cancel" }).focus();
  await page.keyboard.press("1");
  await expect.poll(async () => (await session(page)).source).not.toBe(before);
  await expect(status).toHaveText(/ · not rendered$/);
  await expect(sheet.getByRole("button", { name: "Render", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Download" })).toHaveCount(0);
  // Nothing renders without the tap: the new text waits for Render.
  await page.waitForTimeout(1_000);
  await expect(status).toHaveText(/ · not rendered$/);
  await renderExport(page);
  await expect(sheet.getByRole("button", { name: "Download" })).toBeVisible();
  expect(errors).toEqual([]);
});

interface Sample {
  readonly at: number;
  readonly taskSeconds: number;
  readonly heapBytes: number;
}

async function metrics(cdp: CDPSession): Promise<Sample> {
  await cdp.send("HeapProfiler.collectGarbage");
  const { metrics: values } = (await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
  const value = (name: string) => values.find((metric) => metric.name === name)?.value ?? 0;
  return { at: value("Timestamp"), taskSeconds: value("TaskDuration"), heapBytes: value("JSHeapUsedSize") };
}

/** Main-thread busy fraction over `ms`, and the heap after a collection at its end. */
async function idleWindow(page: Page, cdp: CDPSession, ms: number): Promise<{ cpu: number; heapBytes: number }> {
  const start = await metrics(cdp);
  await page.waitForTimeout(ms);
  const end = await metrics(cdp);
  return { cpu: (end.taskSeconds - start.taskSeconds) / (end.at - start.at), heapBytes: end.heapBytes };
}

/** The live stage and the export module's code are all the open sheet may add. */
const CPU_TOLERANCE = 0.03;
const HEAP_TOLERANCE_BYTES = 4_000_000;

test("idle CPU and memory with the sheet open match the sheet closed", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await countCreated(page);
  const results: Record<string, unknown> = {};
  for (const width of [390, 1440] as const) {
    await page.setViewportSize(VIEWPORTS[width]);
    await startEngine(page, PHASE1_ONBOARD_PATH);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("HeapProfiler.enable");
    await page.waitForTimeout(2_000);
    // Recorded, not compared: before the first open the export code is not loaded yet.
    const neverOpened = await idleWindow(page, cdp, 3_000);
    // The export module is loaded once, as opening the sheet does, before the closed window:
    // the code is the price of the first open, not idle work.
    await openExport(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#ui-export")).toBeHidden();
    await page.waitForTimeout(1_000);
    const closed = await idleWindow(page, cdp, 5_000);
    await openExport(page);
    await page.waitForTimeout(1_000);
    const open = await idleWindow(page, cdp, 5_000);
    const count = await created(page);
    results[String(width)] = { neverOpened, closed, open, exportWorkers: exportWorkers(count).length, videoEncoders: count.videoEncoders };
    expect(exportWorkers(count), `no export worker at ${width}`).toEqual([]);
    expect(count.videoEncoders).toBe(0);
    expect(open.cpu, `CPU open vs closed at ${width}`).toBeLessThanOrEqual(closed.cpu + CPU_TOLERANCE);
    expect(open.heapBytes - closed.heapBytes, `heap open vs closed at ${width}`).toBeLessThanOrEqual(HEAP_TOLERANCE_BYTES);
    await cdp.detach();
  }
  writeMeasurement("export-test-idle", results);
  expect(errors).toEqual([]);
});
