// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Helpers of the scene tests: play a production with its drop looped, record the
// light the stage receives through the test build's scene lab (apps/web/src/testing/
// scene-lab.ts), and replay it offline into the export's own stage to read the final pixels.
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import type { LabResult, LabRun } from "../../../../src/testing/scene-lab";
import { applyText, session, tapToPlay } from "./share-support";
/** The four productions the scene tests compare against the quality bar. */
export const COMPARED = [
  { name: "onboard", template: "melodic-techno/midnight-bloom" },
  { name: "afro", template: "afro-house/red-earth" },
  { name: "indie", template: "indie-dance/coastline" },
  { name: "psy", template: "psytrance/full-moon" },
] as const;
/** The Techno Inspire | Untzel lockup the export draws in the mark of every file (main.ts, #18). */
export const LOCKUP_URL = "./brand/untzel-lockup-dark.png";
const TRACK_LINE = /^([a-z][a-z0-9_-]*):(\s+.*)$/;
/**
 * 64 tracks over every instrument: the library song of tools/sim, one track
 * per instrument, with its first tracks played a second time under new names.
 */
export function stressSixtyFour(): string {
  const library = readFileSync(new URL("../../../../../../tools/sim/fixtures/library.untzel", import.meta.url), "utf8").split("\n");
  const tracks = library.filter((line) => TRACK_LINE.test(line));
  const extra = tracks.slice(0, 64 - tracks.length).map((line) => line.replace(TRACK_LINE, "$1-b:$2"));
  return `${[...library.filter((line) => line.trim() !== ""), ...extra].join("\n")}\n`;
}
/** The text with its `| loop` marker moved to `section drop`, as the scene measurements play it. */
export function loopDrop(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.startsWith("section ") ? line.replace(/\s*\|\s*loop\b/, "") : line))
    .map((line) => (line.startsWith("section drop ") ? `${line} | loop` : line))
    .join("\n");
}
interface LabHooks {
  recordLight(): Promise<void>;
  sceneLab(): Promise<{
    recordedSpan(): { readonly from: number; readonly to: number; readonly programAt: number | null };
    runLab(run: LabRun): Promise<LabResult>;
  }>;
}
/**
 * Opens a template (or the page with `source` applied), records from the next program and
 * waits `seconds` of music. Returns the audio time the recorded program took effect.
 */
export async function recordScene(page: Page, start: { readonly template?: string; readonly source?: string }, seconds = 12): Promise<number> {
  await page.goto(start.template === undefined ? "./" : `./?template=${start.template}`);
  await tapToPlay(page);
  await page.evaluate(() => (globalThis as unknown as { untzelTest: LabHooks }).untzelTest.recordLight());
  const text = start.source ?? loopDrop((await session(page)).source);
  await applyText(page, text);
  await expect.poll(async () => (await session(page)).valid).toBe(true);
  await page.waitForTimeout(seconds * 1_000);
  const span = await page.evaluate(async () => (await (globalThis as unknown as { untzelTest: LabHooks }).untzelTest.sceneLab()).recordedSpan());
  expect(span.programAt, "the new program reached the stage").not.toBeNull();
  return span.programAt ?? 0;
}
/** Replays the recording into an OfflineStage in the page. */
export function runLab(page: Page, run: LabRun): Promise<LabResult> {
  return page.evaluate(async (options) => (await (globalThis as unknown as { untzelTest: LabHooks }).untzelTest.sceneLab()).runLab(options), run);
}
/** The live stage canvas's drawing buffer at the current viewport. */
export function stageBuffer(page: Page): Promise<{ readonly width: number; readonly height: number }> {
  return page.locator("canvas.untzel-stage").evaluate((node) => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
}
