// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's browser checks: read the file back through the export lab of the test
// build and hold it to the attribution: the
// brand mark on every light frame and a closing card of exactly 2 s, both measured
// against negative controls so that removing the mark or shortening the card fails.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Locator, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { LOGO_URL } from "./share-support";

export interface MarkScore {
  readonly brightInk: number;
  readonly separation: number;
  readonly contrast: number;
}
export interface MarkCheck {
  readonly index: number;
  readonly at: number;
  readonly logo: MarkScore;
  readonly url: MarkScore;
  readonly logoControl: MarkScore;
  readonly urlControl: MarkScore;
}
export interface FrameCheck {
  readonly index: number;
  readonly logo: number;
  readonly url: number;
  readonly logoVsNoLogo: number;
  readonly urlVsNoUrl: number;
}
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface TitleFramesReport {
  readonly cardRect: Rect;
  readonly captionRect: Rect;
  readonly captionPixelsInRings: number;
  readonly framesWithoutCard: readonly number[];
  readonly framesWithoutCaption: readonly number[];
  readonly captionControl: MarkScore | null;
  readonly cardControl: MarkScore | null;
}
export interface Mp4Report {
  readonly width: number;
  readonly height: number;
  readonly videoCodec: string | null;
  readonly audioCodec: string | null;
  readonly videoFrames: number;
  readonly firstVideoTimestamp: number;
  readonly lastVideoTimestamp: number;
  readonly sampleRate: number;
  readonly channels: number;
  readonly audioFrames: number;
  readonly firstAudioTimestamp: number;
  readonly firstAttackSeconds: number | null;
  readonly comment: string | null;
  readonly songTitle: string | null;
  readonly title: TitleFramesReport | null;
  readonly lightFrames: number;
  readonly markChecks: readonly MarkCheck[];
  readonly worstMarkContrast: { readonly index: number; readonly logo: number; readonly url: number };
  readonly framesWithoutMark: readonly number[];
  readonly cardFrames: readonly FrameCheck[];
  readonly lastLightFrameUrl: number;
  readonly markPlacement: "centred" | "corner";
  readonly markScrim: Rect;
  readonly markPixelsInRings: number;
}
export interface WavReport {
  readonly frames: number;
  readonly firstAttackSeconds: number | null;
}
export interface ExportDetails {
  readonly codecs: string;
  readonly renderMs: number;
  /** Of renderMs, the codec probe's retries on a busy machine: outside the render budget. */
  readonly codecRetryMs: number;
  readonly audioSamples: number;
  readonly counters: { readonly lateDrops: number; readonly queueDrops: number; readonly nanResets: number };
  readonly rateControl: { readonly lightFrames: number; readonly finestFrames: number; readonly finestQuantizer: number } | null;
}

const FRAMES_PER_BAR_132 = (240 * 48_000) / 132;
/** The closing card: 2 s at 30 fps; its first 8 frames fade in from the light (300 ms). */
export const CARD_FRAMES = 60;
const FADE_FRAMES = 8;
/** Measured thresholds of the closing card. */
export const CARD_MATCH = 8;
export const CARD_CONTROL = 30;
/** A frame carries the mark: half its ink brighter than 200, ink 100 above the scrim. */
const MARK_BRIGHT_INK = 0.5;
const MARK_SEPARATION = 100;
/** Off the mark the same masks see light that does not follow the logo's shape. */
const CONTROL_SEPARATION = 50;
const MARK_CONTRAST = 4.5;

export async function exportReady(page: Page, timeout = 60_000): Promise<number> {
  const started = Date.now();
  await expect(page.locator("#ui-export .ui-export__status")).toHaveText(/^Ready · /, { timeout });
  return Date.now() - started;
}

/**
 * The top bar's Export: the sheet opens and its code loads, which the duration
 * in the status shows ("0:15 + 2 s · not rendered"); nothing renders.
 */
export async function openExport(page: Page): Promise<Locator> {
  await page.locator(".ui-topbar").getByRole("button", { name: "Export", exact: true }).click();
  const sheet = page.locator("#ui-export");
  await expect(sheet.locator(".ui-export__status")).toHaveText(/^\d+:\d\d.* · not rendered$/);
  return sheet;
}

/**
 * A page in a Chrome of its own. The first video render of a browser session pays the
 * H.264 encoder's ~2 s start in quantizer mode. The solo project shares one
 * browser across files, so an earlier file may already have paid it: a test that times
 * the first render needs a browser no other test has used.
 */
export async function freshBrowserPage(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string | undefined): Promise<{ readonly page: Page; close(): Promise<void> }> {
  const browser = await playwright.chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await (await browser.newContext(baseURL === undefined ? {} : { baseURL })).newPage();
  return { page, close: () => browser.close() };
}

/** Render, then Ready: milliseconds from the tap to the finished file. */
export async function renderExport(page: Page, timeout = 60_000): Promise<number> {
  const started = Date.now();
  await page.locator("#ui-export").getByRole("button", { name: "Render", exact: true }).click();
  await exportReady(page, timeout);
  return Date.now() - started;
}

/**
 * A device that was already probed: HD at about 4× real time and, with `with4k`,
 * 4K at about 1.3×. Without it 4K is refused, so the default stays HD. Call it before the
 * sheet first opens: the page reads the probe once.
 */
export async function seedDeviceProbe(page: Page, with4k: boolean): Promise<void> {
  const probe = {
    tiers: [
      { quality: "hd", isSupported: true, framesPerSecond: 120 },
      { quality: "4k", isSupported: with4k, framesPerSecond: with4k ? 40 : null },
    ],
  };
  await page.evaluate(async (value) => {
    await (globalThis as unknown as { untzelTest: { seedDeviceProbe(probe: unknown): Promise<void> } }).untzelTest.seedDeviceProbe(value);
  }, probe);
}

/** Picks a quality tier in the open sheet and waits until it is the pressed one. */
export async function chooseQuality(sheet: Locator, quality: "HD" | "4K"): Promise<void> {
  const option = sheet.getByRole("group", { name: "Quality" }).getByRole("button", { name: new RegExp(`^${quality}`) });
  await option.click();
  await expect(option).toHaveAttribute("aria-pressed", "true");
}

export function details(page: Page): Promise<ExportDetails | null> {
  return page.evaluate(() => (globalThis as unknown as { untzelTest: { exportDetails(): ExportDetails | null } }).untzelTest.exportDetails());
}

/** With `withTitle`, the frames are also held to the song's title card and caption as the page draws them. */
export function inspectMp4(page: Page, withTitle = false): Promise<Mp4Report> {
  return page.evaluate(
    async ({ logo, checkTitle }) => {
      type TitleText = { readonly text: string; readonly detail: string };
      const hooks = (globalThis as unknown as {
        untzelTest: { exportFile(): File | null; exportTitle(): TitleText; exportLab(): Promise<{ inspectMp4(file: Blob, logo: string, title: TitleText | null): Promise<Mp4Report> }> };
      }).untzelTest;
      const file = hooks.exportFile();
      if (file === null) throw new Error("no export");
      return (await hooks.exportLab()).inspectMp4(file, logo, checkTitle ? hooks.exportTitle() : null);
    },
    { logo: LOGO_URL, checkTitle: withTitle },
  );
}

export function inspectWav(page: Page): Promise<WavReport> {
  return page.evaluate(async () => {
    const hooks = (globalThis as unknown as { untzelTest: { exportFile(): File | null; exportLab(): Promise<{ inspectWav(file: Blob, frames: number): Promise<WavReport> }> } }).untzelTest;
    const file = hooks.exportFile();
    if (file === null) throw new Error("no export");
    return (await hooks.exportLab()).inspectWav(file, 0);
  });
}

/** The exported file in .cache/exports/<name>, for ffprobe and a look at its frames. */
export async function saveExport(page: Page, name: string): Promise<void> {
  const base64 = await page.evaluate(async () => {
    const file = (globalThis as unknown as { untzelTest: { exportFile(): File | null } }).untzelTest.exportFile();
    if (file === null) throw new Error("no export");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  });
  const directory = new URL("../../../../../../.cache/exports/", import.meta.url);
  mkdirSync(directory, { recursive: true });
  writeFileSync(new URL(name, directory), Buffer.from(base64, "base64"));
}

/** Frames of `bars` bars at 132 BPM from bar `from`, the transport's floor at both ends. */
export function musicFrames(from: number, bars: number): number {
  return Math.floor((from + bars) * FRAMES_PER_BAR_132) - Math.floor(from * FRAMES_PER_BAR_132);
}

/** Every video frame of `bars` bars from `from`, with the card. */
export function totalFrames(from: number, bars: number): number {
  return Math.ceil(musicFrames(from, bars) / 1_600) + CARD_FRAMES;
}

/**
 * The sound covers the whole video: exactly totalFrames × 1 600 samples went to the encoder,
 * and the decoded track starts at or before 0 (the encoder delay is stamped earlier) and
 * ends at or after the last frame. AAC rounds up to frames of 1 024 samples.
 */
export async function expectAudioCoversVideo(page: Page, report: Mp4Report, total: number): Promise<void> {
  const rendered = await details(page);
  expect(rendered?.audioSamples).toBe(total * 1_600);
  expect(rendered?.counters).toEqual({ lateDrops: 0, queueDrops: 0, nanResets: 0 });
  expect(report.firstAudioTimestamp).toBeLessThanOrEqual(0);
  expect(report.firstAudioTimestamp + report.audioFrames / 48_000).toBeGreaterThanOrEqual(total / 30);
}

/** Exactly 60 card frames: every one after the fade matches the card, and the frame before is light. */
export function expectCard(report: Mp4Report, total: number): void {
  expect(report.lightFrames, "the card is 2 s").toBe(total - CARD_FRAMES);
  const checked = CARD_FRAMES - FADE_FRAMES;
  expect(report.cardFrames.map((frame) => frame.index)).toEqual(Array.from({ length: checked }, (_, i) => total - checked + i));
  for (const frame of report.cardFrames) {
    expect(frame.logo, `frame ${frame.index}: logo`).toBeLessThanOrEqual(CARD_MATCH);
    expect(frame.url, `frame ${frame.index}: URL`).toBeLessThanOrEqual(CARD_MATCH);
    expect(frame.logoVsNoLogo, `frame ${frame.index}: against the card without logo`).toBeGreaterThanOrEqual(CARD_CONTROL);
    expect(frame.urlVsNoUrl, `frame ${frame.index}: against the card without URL`).toBeGreaterThanOrEqual(CARD_CONTROL);
  }
  expect(report.lastLightFrameUrl, "the card comes after the light").toBeGreaterThanOrEqual(CARD_CONTROL);
}

/** The mark on every light frame, sampled at 10, 50 and 90 % with its negative control, at ≥ 4.5:1. */
export function expectMark(report: Mp4Report): void {
  expect(report.framesWithoutMark, "light frames without the mark").toEqual([]);
  expect(report.markChecks.map((check) => check.at)).toEqual([0.1, 0.5, 0.9]);
  for (const check of report.markChecks) {
    for (const [part, score, control] of [
      ["logo", check.logo, check.logoControl],
      ["URL", check.url, check.urlControl],
    ] as const) {
      expect(score.brightInk, `frame ${check.index}: ${part} ink`).toBeGreaterThanOrEqual(MARK_BRIGHT_INK);
      expect(score.separation, `frame ${check.index}: ${part} over its scrim`).toBeGreaterThanOrEqual(MARK_SEPARATION);
      expect(control.separation, `frame ${check.index}: ${part} masks off the mark`).toBeLessThan(CONTROL_SEPARATION);
    }
  }
  expect(Math.min(report.worstMarkContrast.logo, report.worstMarkContrast.url), "the mark's worst contrast").toBeGreaterThanOrEqual(MARK_CONTRAST);
}
/** A landscape file: the mark in the safe area's lower-right corner, none of it on the rings. */
export function expectMarkOffRings(report: Mp4Report): void {
  expect(report.markPlacement, "the 16:9 mark sits in the corner").toBe("corner");
  expect(report.markPixelsInRings, "pixels of the mark and its scrim on the rings").toBe(0);
}

/**
 * The song's title: the card on every frame of its first 1.2 s and the
 * caption on every light frame from 1.5 s, each against the other's masks as a negative
 * control; neither reaches the mark's scrim, the 16:9 caption stays off the rings, and the
 * title is the file's title tag.
 */
export function expectTitle(report: Mp4Report, title: string): void {
  const markScrimTop = report.markScrim.y;
  const check = report.title;
  expect(check, "the title was checked").not.toBeNull();
  if (check === null) return;
  expect(check.framesWithoutCard, "whole card frames without the title card").toEqual([]);
  expect(check.framesWithoutCaption, "light frames from 1.5 s without the caption").toEqual([]);
  expect(check.captionControl?.separation ?? Number.POSITIVE_INFINITY, "the caption's masks on a card frame").toBeLessThan(CONTROL_SEPARATION);
  expect(check.cardControl?.separation ?? Number.POSITIVE_INFINITY, "the card's masks on a caption frame").toBeLessThan(CONTROL_SEPARATION);
  expect(check.cardRect.y + check.cardRect.h, "the card ends above the mark's scrim").toBeLessThanOrEqual(markScrimTop);
  expect(check.captionRect.y + check.captionRect.h, "the caption ends above the mark's scrim").toBeLessThanOrEqual(markScrimTop);
  if (report.markPlacement === "corner") expect(check.captionPixelsInRings, "pixels of the caption on the rings").toBe(0);
  expect(report.songTitle, "the MP4's title tag").toBe(title);
}
