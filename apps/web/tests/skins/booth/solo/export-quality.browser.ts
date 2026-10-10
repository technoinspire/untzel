// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's quality tiers, read back with ffprobe (/opt/homebrew/bin): the story
// 9:16 and the video 16:9 at HD and at 4K, each at its exact resolution, H.264 High at
// 30 fps, AAC at about 320 kbit/s, with the brand mark on every light frame (in the
// corner and off the rings at 16:9) and the 60-frame closing card (decoded in the page).
// The rate: the tier's video bitrate within ±20 % over the
// light is measured on a fixed reference, the onboard's drop at full light (bars 13–20),
// for the 16:9 video at HD and 4K. Any other light may be darker, and a dark picture
// spends fewer bits by nature: there the check is the rate never above +20 % and, below
// −20 %, the quantizer at the scale's finest on at least 90 % of the light frames.
// The device probe is seeded as a device that passed 4K. Then the play range seam:
// bars 9–28 of the onboard song, played once, are 20 bars at 132 BPM plus the 2 s card,
// ±1 frame. Every file is a progressive MP4: its top-level boxes put the moov before the
// mdat (the moov is reserved up front, the file never fragmented), ffprobe's
// duration matches its frames, and each story and video plays in a <video> in Chrome. Each file and one light frame of it (PNG, by ffmpeg) go to
// .cache/exports/.
import { execFileSync } from "node:child_process";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  chooseQuality,
  details,
  expectCard,
  expectMark,
  expectMarkOffRings,
  inspectMp4,
  musicFrames,
  openExport,
  renderExport,
  saveExport,
  seedDeviceProbe,
  totalFrames,
  type ExportDetails,
} from "../support/export-support";
import { writeMeasurement } from "../support/measure-support";
import { PHASE1_ONBOARD_PATH, playMode, startEngine, stopMusic } from "../support/share-support";
import { VIEWPORTS, collectErrors } from "../../../support/support";

const FFPROBE = "/opt/homebrew/bin/ffprobe";
const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const EXPORTS = fileURLToPath(new URL("../../../../../../.cache/exports/", import.meta.url));

type Quality = "HD" | "4K";
type Format = "Story" | "Video";

const TIERS: Readonly<Record<Quality, { readonly bitrate: number; readonly level: number; readonly short: number; readonly long: number }>> = {
  HD: { bitrate: 12_000_000, level: 40, short: 1080, long: 1920 },
  "4K": { bitrate: 30_000_000, level: 51, short: 2160, long: 3840 },
};
/** The onboard's first drop, at full light: the fixed reference of the rate. */
const DROP = { startBar: 13, endBar: 20 } as const;
/** Below the rate, a dark picture passes when this share of its light is at the finest quantizer. */
const FINEST_SHARE = 0.9;
const AAC_BITRATE = 320_000;
const BITRATE_TOLERANCE = 0.2;

interface Streams {
  readonly video: {
    readonly codec: string;
    readonly profile: string;
    readonly level: number;
    readonly width: number;
    readonly height: number;
    readonly frameRate: string;
    readonly frames: number;
    readonly seconds: number;
    readonly bitrate: number;
  };
  readonly audio: { readonly codec: string; readonly bitrate: number; readonly sampleRate: number; readonly channels: number };
}

interface StreamJson {
  readonly codec_type: string;
  readonly codec_name: string;
  readonly profile?: string;
  readonly level?: number;
  readonly width?: number;
  readonly height?: number;
  readonly r_frame_rate?: string;
  readonly avg_frame_rate?: string;
  readonly nb_frames?: string;
  readonly duration?: string;
  readonly bit_rate?: string;
  readonly sample_rate?: string;
  readonly channels?: number;
}

function ffprobe(path: string): Streams {
  const json = execFileSync(FFPROBE, ["-v", "error", "-show_streams", "-of", "json", path], { encoding: "utf8" });
  const streams = (JSON.parse(json) as { streams: StreamJson[] }).streams;
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  if (video === undefined || audio === undefined) throw new Error(`${path}: needs a video and an audio stream`);
  return {
    video: {
      codec: video.codec_name,
      profile: video.profile ?? "",
      level: video.level ?? 0,
      width: video.width ?? 0,
      height: video.height ?? 0,
      frameRate: video.avg_frame_rate ?? "",
      frames: Number(video.nb_frames),
      seconds: Number(video.duration),
      bitrate: Number(video.bit_rate),
    },
    audio: { codec: audio.codec_name, bitrate: Number(audio.bit_rate), sampleRate: Number(audio.sample_rate), channels: audio.channels ?? 0 },
  };
}

/** The file's top-level box types in order, read from their headers (size, type, and the 64-bit size). */
function topLevelBoxes(path: string): string[] {
  const types: string[] = [];
  const size = statSync(path).size;
  const handle = openSync(path, "r");
  try {
    const header = Buffer.alloc(16);
    for (let position = 0; position + 8 <= size; ) {
      readSync(handle, header, 0, 16, position);
      const short = header.readUInt32BE(0);
      const length = short === 1 ? Number(header.readBigUInt64BE(8)) : short === 0 ? size - position : short;
      types.push(header.toString("latin1", 4, 8));
      if (length < 8) break;
      position += length;
    }
  } finally {
    closeSync(handle);
  }
  return types;
}

/** A progressive MP4 for social uploads and QuickTime: ftyp, then moov, then mdat; no moof. */
function expectProgressive(path: string): void {
  const boxes = topLevelBoxes(path);
  expect(boxes[0], `${path}: first box`).toBe("ftyp");
  expect(boxes.indexOf("moov"), `${path}: ${boxes.join(" ")}`).toBeGreaterThan(0);
  expect(boxes.indexOf("moov"), `${path}: ${boxes.join(" ")}`).toBeLessThan(boxes.indexOf("mdat"));
  expect(boxes, `${path}: not fragmented`).not.toContain("moof");
}

/** Video bits per second over the light, the frames before the card, packet by packet. */
function lightBitrate(path: string, lightFrames: number): number {
  const csv = execFileSync(FFPROBE, ["-v", "error", "-select_streams", "v", "-show_entries", "packet=pts_time,size", "-of", "csv=p=0", path], { encoding: "utf8" });
  const end = (lightFrames - 0.5) / 30;
  let bits = 0;
  for (const row of csv.trim().split("\n")) {
    const [time, size] = row.split(",").map(Number);
    if ((time ?? Number.POSITIVE_INFINITY) < end) bits += (size ?? 0) * 8;
  }
  return bits / (lightFrames / 30);
}

/** One light frame of the file, at its own size, for a look at the composition. */
function lightFramePng(path: string, seconds: number): string {
  const png = path.replace(/\.mp4$/, ".png");
  execFileSync(FFMPEG, ["-y", "-v", "error", "-ss", seconds.toFixed(3), "-i", path, "-frames:v", "1", png]);
  return png;
}

function dimensions(format: Format, quality: Quality): readonly [number, number] {
  const tier = TIERS[quality];
  return format === "Story" ? [tier.short, tier.long] : [tier.long, tier.short];
}

/** The reference: the drop's full light reaches the tier's rate, ±20 %. */
function expectReferenceRate(lightBits: number, quality: Quality): void {
  const { bitrate } = TIERS[quality];
  expect(lightBits, `${quality} video bitrate over the drop`).toBeGreaterThanOrEqual(bitrate * (1 - BITRATE_TOLERANCE));
  expect(lightBits, `${quality} video bitrate over the drop`).toBeLessThanOrEqual(bitrate * (1 + BITRATE_TOLERANCE));
}

/** Any light: never above the rate; below it, only with the quantizer at its finest (a dark picture). */
function expectLightQuality(lightBits: number, rendered: ExportDetails | null, label: string, quality: Quality): void {
  const { bitrate } = TIERS[quality];
  expect(lightBits, `${label} video bitrate over the light`).toBeLessThanOrEqual(bitrate * (1 + BITRATE_TOLERANCE));
  if (lightBits >= bitrate * (1 - BITRATE_TOLERANCE)) return;
  const rate = rendered?.rateControl ?? null;
  expect(rate, `${label}: below the rate, the governor's report`).not.toBeNull();
  expect((rate?.finestFrames ?? 0) / Math.max(1, rate?.lightFrames ?? 0), `${label}: light at the finest quantizer`).toBeGreaterThanOrEqual(FINEST_SHARE);
}

function expectTier(path: string, streams: Streams, format: Format, quality: Quality, frames: number): void {
  const tier = TIERS[quality];
  const [width, height] = dimensions(format, quality);
  expectProgressive(path);
  expect(streams.video).toMatchObject({ codec: "h264", profile: "High", level: tier.level, width, height, frameRate: "30/1", frames });
  expect(Math.abs(streams.video.seconds - frames / 30), `${format} ${quality} duration, ±1 frame`).toBeLessThanOrEqual(1 / 30);
  expect(streams.audio).toMatchObject({ codec: "aac", sampleRate: 48_000, channels: 2 });
  expect(streams.audio.bitrate, `${format} ${quality} AAC bitrate`).toBeGreaterThanOrEqual(AAC_BITRATE * (1 - BITRATE_TOLERANCE));
  expect(streams.audio.bitrate, `${format} ${quality} AAC bitrate`).toBeLessThanOrEqual(AAC_BITRATE * (1 + BITRATE_TOLERANCE));
}

/** The kept file in a muted <video>: Chrome reads its moov first, knows its length and plays past a second. */
async function expectPlaysInChrome(page: Page, frames: number): Promise<{ readonly duration: number; readonly playedTo: number }> {
  const played = await page.evaluate(async () => {
    const file = (globalThis as unknown as { untzelTest: { exportFile(): File | null } }).untzelTest.exportFile();
    if (file === null) return null;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.src = url;
    try {
      await video.play();
      await new Promise<void>((resolve, reject) => {
        const check = () => (video.currentTime > 1 ? resolve() : undefined);
        video.addEventListener("timeupdate", check);
        video.addEventListener("error", () => reject(new Error(video.error?.message ?? "video error")));
        setTimeout(() => reject(new Error(`stalled at ${video.currentTime} s`)), 10_000);
      });
      return { duration: video.duration, playedTo: video.currentTime };
    } finally {
      video.pause();
      URL.revokeObjectURL(url);
    }
  });
  expect(played, "the file plays in a <video>").not.toBeNull();
  expect(Math.abs((played?.duration ?? 0) - frames / 30), "the <video>'s duration, ±0.1 s").toBeLessThanOrEqual(0.1);
  return played ?? { duration: 0, playedTo: 0 };
}

/** 8 bars from bar 1, stopped: the story's own length at 132 BPM, and the video's Bars 8. */
async function renderTier(page: Page, sheet: Locator, format: Format, quality: Quality): Promise<Record<string, unknown>> {
  await sheet.getByRole("button", { name: new RegExp(`^${format}`) }).click();
  if (format === "Video") await sheet.getByLabel("Bars").selectOption("8");
  await chooseQuality(sheet, quality);
  await expect(sheet.locator(".ui-export__origin")).toHaveText("from bar 1 · 8 bars");
  const elapsedMs = await renderExport(page, 240_000);
  const name = `${format.toLowerCase()}-${quality.toLowerCase()}.mp4`;
  await saveExport(page, name);
  const path = `${EXPORTS}${name}`;
  const total = totalFrames(0, 8);
  const streams = ffprobe(path);
  const report = await inspectMp4(page);
  const png = lightFramePng(path, (total - 60) / 2 / 30);
  const lightBits = lightBitrate(path, total - 60);
  const rendered = await details(page);
  const playback = await expectPlaysInChrome(page, total);
  expectTier(path, streams, format, quality, total);
  expectLightQuality(lightBits, rendered, `${format} ${quality}`, quality);
  expectMark(report);
  if (format === "Video") expectMarkOffRings(report);
  expectCard(report, total);
  return {
    elapsedMs,
    path,
    png,
    streams,
    playback,
    lightBitrate: lightBits,
    rateControl: rendered?.rateControl ?? null,
    lightFrames: report.lightFrames,
    worstMarkContrast: report.worstMarkContrast,
    cardFrames: report.cardFrames.length,
    markPlacement: report.markPlacement,
    markPixelsInRings: report.markPixelsInRings,
  };
}

/** The 16:9 video over the drop, bars 13–20 of the song, once: the rate's fixed reference. */
async function renderReference(page: Page, sheet: Locator, quality: Quality): Promise<Record<string, unknown>> {
  await chooseQuality(sheet, quality);
  await expect(sheet.locator(".ui-export__origin")).toHaveText("from bar 13 · 8 bars");
  const elapsedMs = await renderExport(page, 240_000);
  const name = `drop-${quality.toLowerCase()}.mp4`;
  await saveExport(page, name);
  const path = `${EXPORTS}${name}`;
  const total = totalFrames(12, 8);
  const streams = ffprobe(path);
  const report = await inspectMp4(page);
  const png = lightFramePng(path, (total - 60) / 2 / 30);
  const lightBits = lightBitrate(path, total - 60);
  const rendered = await details(page);
  expectTier(path, streams, "Video", quality, total);
  expectReferenceRate(lightBits, quality);
  expectMark(report);
  expectMarkOffRings(report);
  expectCard(report, total);
  return { elapsedMs, path, png, streams, lightBitrate: lightBits, rateControl: rendered?.rateControl ?? null, markPixelsInRings: report.markPixelsInRings };
}

test("HD: the story 9:16 and the video 16:9 at their size, rate and frame rate, with the mark and the card", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, true);
  await stopMusic(page);
  const sheet = await openExport(page);
  const story = await renderTier(page, sheet, "Story", "HD");
  const video = await renderTier(page, sheet, "Video", "HD");
  writeMeasurement("export-test-quality-hd", { story, video });
  expect(errors).toEqual([]);
});

test("4K: the story 9:16 and the video 16:9 at their size, bitrate and frame rate, with the mark and the card", async ({ page }) => {
  test.setTimeout(600_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, true);
  await stopMusic(page);
  const sheet = await openExport(page);
  // A device that passed 4K is offered it, and it is the default.
  await expect(sheet.getByRole("group", { name: "Quality" }).getByRole("button", { name: /^4K/ })).toHaveAttribute("aria-pressed", "true");
  const story = await renderTier(page, sheet, "Story", "4K");
  const video = await renderTier(page, sheet, "Video", "4K");
  writeMeasurement("export-test-quality-4k", { story, video });
  expect(errors).toEqual([]);
});

test("the rate's reference: the 16:9 video over the onboard's drop reaches each tier, ±20 %", async ({ page }) => {
  test.setTimeout(600_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, true);
  await playMode(page, "song");
  await stopMusic(page);
  await page.evaluate((range) => (globalThis as unknown as { untzelTest: { exportPlayRange(range: unknown): void } }).untzelTest.exportPlayRange(range), DROP);
  const sheet = await openExport(page);
  await sheet.getByRole("button", { name: /^Video/ }).click();
  const hd = await renderReference(page, sheet, "HD");
  const uhd = await renderReference(page, sheet, "4K");
  writeMeasurement("export-test-rate-reference", { range: DROP, hd, uhd });
  expect(errors).toEqual([]);
});

test("a device that did not pass 4K is never offered it", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, false);
  const sheet = await openExport(page);
  const qualities = sheet.getByRole("group", { name: "Quality" }).getByRole("button");
  await expect(qualities).toHaveCount(1);
  await expect(qualities.first()).toHaveText(/^HD1080 × 1920 · about \d+ s to render$/);
});

test("the play range: bars 9–28 of the song, once, then the card, ±1 frame", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, false);
  await playMode(page, "song");
  await page.evaluate(() => (globalThis as unknown as { untzelTest: { exportPlayRange(range: unknown): void } }).untzelTest.exportPlayRange({ startBar: 9, endBar: 28 }));
  const sheet = await openExport(page);
  await sheet.getByRole("button", { name: /^Video/ }).click();
  await expect(sheet.locator(".ui-export__origin")).toHaveText("from bar 9 · 20 bars");
  // The estimate and the label use the range's length: 20 bars at 132 BPM is 0:36.
  await expect(sheet.locator(".ui-export__status")).toHaveText("0:36 + 2 s · not rendered");
  await expect(sheet.getByRole("group", { name: "Quality" }).getByRole("button", { name: /^HD/ })).toHaveText(/about \d+ s to render$/);
  const elapsedMs = await renderExport(page, 180_000);
  await saveExport(page, "range-9-28.mp4");
  const path = `${EXPORTS}range-9-28.mp4`;
  const streams = ffprobe(path);
  const total = totalFrames(8, 20);
  const expectedSeconds = (20 * 240) / 132 + 2;
  const report = await inspectMp4(page);
  writeMeasurement("export-test-play-range", { elapsedMs, path, streams, expectedFrames: total, expectedSeconds, musicFrames: musicFrames(8, 20) });
  expectProgressive(path);
  expect(streams.video.frames).toBe(total);
  expect(Math.abs(streams.video.seconds - expectedSeconds), "20 bars plus the card, ±1 frame").toBeLessThanOrEqual(1 / 30);
  expectCard(report, total);
  expectMark(report);
  expect(errors).toEqual([]);
});
