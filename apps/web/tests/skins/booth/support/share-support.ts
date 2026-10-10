// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Helpers of the share and export browser tests: the real engine, its test hooks, and the
// export lab of the test build (apps/web/src/testing/export-lab.ts).
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { firstTouchTemplate, readTemplateTree } from "@untzel/sim/template-tree";

/** The text of the first-touch template (`// default: true`, Midnight Bloom): what the first tap plays. */
export const ONBOARD = firstTouchTemplate(readTemplateTree(fileURLToPath(new URL("../../../../../../", import.meta.url)))).text;
/** The Techno Inspire | Untzel lockup the video mark and closing card draw. */
export const LOGO_URL = "./brand/untzel-lockup-dark.png";
/**
 * The phase 1 onboard (132 BPM, tools/sim/fixtures/phase1-onboard.untzel), for the
 * export tests whose bar and frame numbers are about it.
 */
export const PHASE1_ONBOARD_PATH = "./?template=phase1-onboard";

export interface SessionSnapshot {
  readonly source: string;
  readonly valid: boolean;
  readonly playing: boolean;
  readonly mode: "loop" | "song" | null;
}

export async function startEngine(page: Page, path = "./"): Promise<void> {
  await page.goto(path);
  await tapToPlay(page);
}

/** The tap, then the engine playing. Received text plays in song mode, which has no Drop button. */
export async function tapToPlay(page: Page, button = "Tap to play"): Promise<void> {
  await page.getByRole("button", { name: button }).click();
  await waitPlaying(page);
}

export async function waitPlaying(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const hooks = (globalThis as unknown as { untzelTest?: { session(): { playing: boolean } } }).untzelTest;
    return hooks !== undefined && hooks.session().playing;
  });
}

export function session(page: Page): Promise<SessionSnapshot> {
  return page.evaluate(() => {
    const view = (globalThis as unknown as { untzelTest: { session(): SessionSnapshot } }).untzelTest.session();
    return { source: view.source, valid: view.valid, playing: view.playing, mode: view.mode };
  });
}

export function applyText(page: Page, text: string): Promise<void> {
  return page.evaluate((value) => {
    (globalThis as unknown as { untzelTest: { applyText(text: string): void } }).untzelTest.applyText(value);
  }, text);
}

/** The next 4-bar phrase at 132 BPM is at most 7.3 s away: a mode change waits for it. */
export const PHRASE_TIMEOUT_MS = 10_000;
/** Song or loop on the running session, as the Loop / Song selector does; waits until it sounds. */
export async function playMode(page: Page, mode: "loop" | "song"): Promise<void> {
  await page.evaluate((value) => (globalThis as unknown as { untzelTest: { play(mode: string): unknown } }).untzelTest.play(value), mode);
  await expect.poll(async () => (await session(page)).mode, { timeout: PHRASE_TIMEOUT_MS }).toBe(mode);
}
export function stopMusic(page: Page): Promise<void> {
  return page.evaluate(() => (globalThis as unknown as { untzelTest: { stop(): void } }).untzelTest.stop());
}

/** The play range of the mode asked for, through the real use case, as a released handle sets it. */
export async function setPlayRange(page: Page, startBar: number, endBar: number): Promise<void> {
  await page.evaluate(
    (range) => (globalThis as unknown as { untzelTest: { exportPlayRange(range: unknown): void } }).untzelTest.exportPlayRange(range),
    { startBar, endBar, cycle: true },
  );
}
/** The transport's range line: "Range: bars 2–3", or the whole-loop hint without a range. */
export function rangeLabel(page: Page) {
  return page.locator(".ui-transport .ui-range-row__label");
}
/**
 * From now on, every loop bar the transport reports, in order: call it before the tap, so
 * the first bar that plays is never missed while the test waits. The transport's report,
 * not the position line, which draws the bar before the first one for a frame.
 */
export async function watchBars(page: Page): Promise<void> {
  await page.evaluate(() => {
    const heard: number[] = [];
    (globalThis as unknown as { untzelBarsHeard: number[] }).untzelBarsHeard = heard;
    const tick = (): void => {
      const hooks = (globalThis as unknown as { untzelTest?: { session(): { position: { loopBar: number | null } | null } } }).untzelTest;
      const loopBar = hooks?.session().position?.loopBar ?? null;
      const bar = loopBar === null ? null : loopBar + 1;
      if (bar !== null && heard.at(-1) !== bar) heard.push(bar);
      requestAnimationFrame(tick);
    };
    tick();
  });
}
/** Since watchBars: the music started on the range's first bar and stayed inside it, for two bars and more. */
export async function expectPlaysRange(page: Page, startBar: number, endBar: number): Promise<void> {
  await page.waitForTimeout(4_500);
  const heard = await page.evaluate(() => (globalThis as unknown as { untzelBarsHeard: number[] }).untzelBarsHeard);
  expect(heard[0], `the first bar heard: ${heard.join(" ")}`).toBe(startBar);
  expect(heard.length, "the music moved on").toBeGreaterThan(1);
  expect(heard.every((bar) => bar >= startBar && bar <= endBar), `only bars ${startBar} to ${endBar}: ${heard.join(" ")}`).toBe(true);
}

/** The Share sheet, from the project menu (Share left the top bar for the menu). */
export async function openShare(page: Page): Promise<void> {
  await page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Share link/ }).click();
}
/** The aria-live region of the shell, eventually saying `message`. */
export async function expectAnnounced(page: Page, message: string): Promise<void> {
  await expect(page.locator(".ui-app [aria-live]")).toHaveText(message, { timeout: 5_000 });
}

/** "#v1." + base64url(deflate-raw(text)), made in Node with the same codec the page uses. */
export async function linkFragment(text: string): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return `#v1.${Buffer.from(await new Response(stream).arrayBuffer()).toString("base64url")}`;
}

/** The text a v1 link carries, decoded in Node: the inverse of linkFragment. */
export async function linkText(url: string): Promise<string> {
  const payload = /#v1\.([A-Za-z0-9_-]+)(?:&[^#]*)?$/.exec(url)?.[1];
  if (payload === undefined) throw new Error(`not a v1 link: ${url}`);
  const stream = new Blob([Buffer.from(payload, "base64url")]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/** What a received link plays: the same text titled "Remix of <title>". */
export function remixOf(text: string): string {
  return text.replace(/^title "(.*)"$/m, (_line, title: string) => `title "Remix of ${title}"`);
}
/** The onboard with one change that analyzes: a different tempo. */
export function edited(tempo: number): string {
  return ONBOARD.replace(/^tempo \d+$/m, `tempo ${tempo}`);
}
