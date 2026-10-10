// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The attribution and the cards in a demo video. The
// interface frames carry the app's own logo and footer, checked in the page at the instant
// of sampled frames (the first and the last after the title card, and one every 10 s). The
// title card and the closing card are checked in the finished MP4 by the export lab of the
// test build, in the same Chrome: the export's references, drawn by the export's functions.
import type { Page } from "@playwright/test";
import { FPS, TITLE_CARD_FRAMES } from "../frame-time";

/** The footer's phrase. */
export const ATTRIBUTION_PHRASE = "Powered by Untzel · Techno Inspire";

/** Measured thresholds of the closing card (as export.browser.ts). */
export const CARD_MATCH = 8;

export const CARD_CONTROL = 30;

const SAMPLE_EVERY_FRAMES = 10 * FPS;

export interface AttributionSample {
  readonly frame: number;
  readonly isVisible: boolean;
  readonly text: string;
}

/** The first interface frame after the title card, and one every 10 s after it. */
export function isSampledFrame(frame: number): boolean {
  return frame >= TITLE_CARD_FRAMES && (frame - TITLE_CARD_FRAMES) % SAMPLE_EVERY_FRAMES === 0;
}

/** The interface frames sampled: `first`, every 10 s after it, and `last`. Pure. */
export function attributionFrames(first: number, last: number): number[] {
  const frames: number[] = [];
  for (let frame = first; frame < last; frame += SAMPLE_EVERY_FRAMES) frames.push(frame);
  return last >= first ? [...frames, last] : frames;
}

export interface AttributionVerdict {
  readonly ok: boolean;
  readonly sampled: number;
  /** Frames where the logo or the footer was out of the window, covered, or said something else. */
  readonly missing: readonly number[];
}

export function attributionVerdict(samples: readonly AttributionSample[], expectedFrames: readonly number[]): AttributionVerdict {
  const missing = expectedFrames.filter((frame) => {
    const sample = samples.find((entry) => entry.frame === frame);
    return sample === undefined || !sample.isVisible || sample.text !== ATTRIBUTION_PHRASE;
  });
  return { ok: missing.length === 0, sampled: samples.length, missing };
}

/** What the export lab's inspectMp4 says of the cards (apps/web/src/testing/export-lab.ts). */
export interface CardReport {
  readonly videoFrames: number;
  readonly lightFrames: number;
  readonly cardFrames: readonly { readonly index: number; readonly logo: number; readonly url: number; readonly logoVsNoLogo: number; readonly urlVsNoUrl: number }[];
  readonly lastLightFrameUrl: number;
  /** Title card frames (before its exit) whose card failed the floor; null without a title. */
  readonly titleFramesWithoutCard: readonly number[] | null;
}

export interface CardVerdict {
  readonly ok: boolean;
  readonly problems: readonly string[];
}

/** The closing card on the last 2 s, after the light, and the title card on its frames. Pure. */
export function cardVerdict(report: CardReport, brandFrames: number): CardVerdict {
  const problems: string[] = [];
  if (report.lightFrames !== report.videoFrames - brandFrames) problems.push(`${report.videoFrames - report.lightFrames} closing card frames, not ${brandFrames}`);
  if (report.cardFrames.length === 0) problems.push("no closing card frame was checked");
  for (const frame of report.cardFrames) {
    if (frame.logo > CARD_MATCH || frame.url > CARD_MATCH) problems.push(`frame ${frame.index}: the closing card differs from the reference`);
    if (frame.logoVsNoLogo < CARD_CONTROL || frame.urlVsNoUrl < CARD_CONTROL) problems.push(`frame ${frame.index}: the closing card lacks its logo or its URL`);
  }
  if (report.lastLightFrameUrl < CARD_CONTROL) problems.push("the last interface frame already looks like the card");
  if (report.titleFramesWithoutCard === null) problems.push("the title card was not checked");
  else if (report.titleFramesWithoutCard.length > 0) problems.push(`title card missing on frames ${report.titleFramesWithoutCard.join(", ")}`);
  return { ok: problems.length === 0, problems };
}

interface LabReport {
  readonly videoFrames: number;
  readonly lightFrames: number;
  readonly cardFrames: CardReport["cardFrames"];
  readonly lastLightFrameUrl: number;
  readonly title: { readonly framesWithoutCard: readonly number[] } | null;
}

interface LabHooks {
  exportTitle(): { readonly text: string; readonly detail: string };
  exportLab(): Promise<{ inspectMp4(file: Blob, logoUrl: string, title: { readonly text: string; readonly detail: string } | null): Promise<LabReport> }>;
}

/** Reads the MP4 back in the page, served from the page's own origin under a path of its own. */
export async function inspectCards(page: Page, file: string): Promise<CardReport> {
  const path = `/__demo-video/${encodeURIComponent(file.split("/").at(-1) ?? "demo.mp4")}`;
  await page.route(`**${path}`, (route) => route.fulfill({ path: file, contentType: "video/mp4" }));
  try {
    const report = await page.evaluate(async (url) => {
      const hooks = (globalThis as unknown as { untzelTest: LabHooks }).untzelTest;
      const lab = await hooks.exportLab();
      const blob = await (await fetch(url)).blob();
      const { text, detail } = hooks.exportTitle();
      return lab.inspectMp4(blob, "./brand/untzel-lockup-dark.png", { text, detail });
    }, path);
    return {
      videoFrames: report.videoFrames,
      lightFrames: report.lightFrames,
      cardFrames: report.cardFrames,
      lastLightFrameUrl: report.lastLightFrameUrl,
      titleFramesWithoutCard: report.title?.framesWithoutCard ?? null,
    };
  } finally {
    await page.unroute(`**${path}`);
  }
}
