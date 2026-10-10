// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The capture's browser: the test build served by Vite's
// preview with the app's own Content-Security-Policy, the installed Chrome without a window,
// the ?demo page on Playwright's fake clock, and one PNG per video frame. Between two frames
// the page's time moves exactly 1/30 s: timers and animation frames by the fake clock, CSS
// animations by the Animation domain (animation-clock.ts). Nothing here depends on how fast
// the machine is.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type CDPSession, type Page } from "@playwright/test";
import { preview, type PreviewServer } from "vite";
import { APP_CONTENT_SECURITY_POLICY } from "../../../harness/app-content-security-policy.mjs";
import { AnimationClock } from "./animation-clock";
import type { CaptureFormat } from "./video/capture-formats";
import { msOfFrame } from "./frame-time";
import type { GesturePage } from "./gesture-page";
import type { Point } from "./gesture-schedule";

/** The demo hooks of the page (apps/web/src/testing/demo/demo-hooks.ts). */
export interface DemoHooks {
  armTake(): Promise<number>;
  finishTake(): Promise<string>;
  sessionText(): string;
  stageRenderer(): string | null;
  attribution(): { readonly isVisible: boolean; readonly text: string };
  showCard(kind: "title" | "brand", song?: unknown): Promise<void>;
  hideCards(): void;
}

export interface BrowserSessionOptions {
  /** The repository root. */
  readonly repo: string;
  readonly format: CaptureFormat;
  readonly reducedMotion: boolean;
  /** Where the frames go; null captures nothing (a dry run). */
  readonly framesDirectory: string | null;
}

type DemoWindow = typeof globalThis & { untzelDemo?: DemoHooks };

/** The hooks as the recorder calls them: every answer crosses to Node. */
export interface DemoCalls {
  armTake(): Promise<number>;
  finishTake(): Promise<string>;
  sessionText(): Promise<string>;
  stageRenderer(): Promise<string | null>;
  attribution(): Promise<{ readonly isVisible: boolean; readonly text: string }>;
  showCard(kind: "title" | "brand", song?: unknown): Promise<void>;
  hideCards(): Promise<void>;
}

/** The page's real waits (an element to appear, a click) never take longer than this. */
const ACTION_TIMEOUT_MS = 15_000;

export class BrowserSession {
  readonly page: Page;
  readonly #browser: Browser;
  readonly #server: PreviewServer;
  readonly #cdp: CDPSession;
  readonly #animations: AnimationClock;
  readonly #options: BrowserSessionOptions;
  /** performance.now() of the page at frame 0. */
  readonly #origin: number;
  readonly #writes: Promise<void>[] = [];
  #frame = 0;
  #cursor: Point;
  private constructor(parts: { page: Page; browser: Browser; server: PreviewServer; cdp: CDPSession; animations: AnimationClock; options: BrowserSessionOptions; origin: number }) {
    this.page = parts.page;
    this.#browser = parts.browser;
    this.#server = parts.server;
    this.#cdp = parts.cdp;
    this.#animations = parts.animations;
    this.#options = parts.options;
    this.#origin = parts.origin;
    const { width, height } = parts.options.format.viewport;
    this.#cursor = { x: width / 2, y: height / 2 };
  }

  /** Serves dist-test, opens the demo page, starts from an empty project, and stops the clock. */
  static async open(options: BrowserSessionOptions): Promise<BrowserSession> {
    const server = await preview({
      root: join(options.repo, "apps/web"),
      mode: "test",
      logLevel: "error",
      preview: { port: 0, host: "127.0.0.1", strictPort: false, headers: { "content-security-policy": APP_CONTENT_SECURITY_POLICY } },
    });
    const url = server.resolvedUrls?.local[0];
    if (url === undefined) throw new Error("vite preview gave no URL");
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
    const { viewport, deviceScaleFactor } = options.format;
    const context = await browser.newContext({ viewport, deviceScaleFactor, locale: "en-US", reducedMotion: options.reducedMotion ? "reduce" : "no-preference" });
    const page = await context.newPage();
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    page.on("pageerror", (error) => console.error(`page: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") console.error(`page console: ${message.text()}`);
    });
    await page.clock.install();
    await page.goto(`${url}?demo&template=blank&lang=en`);
    await page.getByRole("button", { name: "Start from scratch" }).click();
    await page.waitForFunction(() => (globalThis as DemoWindow).untzelDemo !== undefined);
    // From here the page's time moves only when the recorder moves it.
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
    const origin = await page.evaluate(() => performance.now());
    const cdp = await context.newCDPSession(page);
    const animations = await AnimationClock.hold(cdp, origin);
    return new BrowserSession({ page, browser, server, cdp, animations, options, origin });
  }

  /** The video frame the page is on: 0 is the arm. */
  get frame(): number {
    return this.#frame;
  }

  get cursor(): Point {
    return this.#cursor;
  }

  /** The page's demo hooks, called from here. */
  get demo(): DemoCalls {
    const page = this.page;
    return {
      armTake: () => page.evaluate(() => (globalThis as DemoWindow).untzelDemo?.armTake() ?? Promise.reject(new Error("no demo hooks"))),
      finishTake: () => page.evaluate(() => (globalThis as DemoWindow).untzelDemo?.finishTake() ?? Promise.reject(new Error("no demo hooks"))),
      sessionText: () => page.evaluate(() => (globalThis as DemoWindow).untzelDemo?.sessionText() ?? ""),
      stageRenderer: () => page.evaluate(() => (globalThis as DemoWindow).untzelDemo?.stageRenderer() ?? null),
      attribution: () => page.evaluate(() => (globalThis as DemoWindow).untzelDemo?.attribution() ?? { isVisible: false, text: "" }),
      showCard: (kind, song) => page.evaluate(([which, what]) => (globalThis as DemoWindow).untzelDemo?.showCard(which, what) ?? Promise.reject(new Error("no demo hooks")), [kind, song] as const),
      hideCards: () => page.evaluate(() => (globalThis as DemoWindow).untzelDemo?.hideCards()),
    };
  }

  /** Moves the visible cursor; the next frame shows it there. */
  async moveCursor(point: Point): Promise<void> {
    this.#cursor = point;
    await this.page.mouse.move(point.x, point.y);
  }

  /** Called after each captured frame (the attribution samples). */
  onFrame: ((frame: number) => Promise<void>) | null = null;
  /** Moves the page's time to the next frame and captures it (`capture` false: only the time). */
  async advance(frames = 1, capture = true): Promise<void> {
    for (let index = 0; index < frames; index += 1) {
      const next = this.#frame + 1;
      // The fake clock moves in whole milliseconds and rounds a fraction up: 33⅓ ms would run
      // as 34 and the page would gain 2 % on the video. Whole steps from the rounded targets
      // (33, 33, 34, …) keep frame k at k × 33⅓ ms, to the millisecond.
      const elapsed = Math.round(msOfFrame(next));
      await this.page.clock.runFor(elapsed - Math.round(msOfFrame(this.#frame)));
      await this.#animations.seek(this.#origin + elapsed);
      this.#frame = next;
      if (!capture) continue;
      await this.capture();
      await this.onFrame?.(next);
    }
  }

  /** Advances until `frame` (no-op when the page is there or past it). */
  async advanceTo(frame: number): Promise<void> {
    if (frame > this.#frame) await this.advance(frame - this.#frame);
  }

  /** Writes what the page shows now as video frame `as` (the frame it is on, by default). */
  async capture(as: number = this.#frame): Promise<void> {
    const directory = this.#options.framesDirectory;
    if (directory === null) return;
    // Playwright's screenshot, in device pixels: the format's frame (1920 × 1080 for Video).
    // The DevTools call answers in CSS pixels without a clip, and with a clip or beyond the
    // viewport it puts the page back at a pixel ratio of 1, so every later frame is drawn at
    // 1440 × 810 and scaled up (measured 07/10/2026). The caret stays as a person sees it.
    const shot = await this.page.screenshot({ type: "png", scale: "device", caret: "initial", animations: "allow" });
    mkdirSync(directory, { recursive: true });
    const file = join(directory, `frame-${String(as).padStart(6, "0")}.png`);
    this.#writes.push(Promise.resolve().then(() => writeFileSync(file, shot)));
  }

  /** This session's page as the gestures see it: Playwright's Page satisfies GesturePage. */
  get gesturePage(): GesturePage {
    return this.page;
  }

  /** Lets the page's time run on its own again (the checks after the capture decode video). */
  async release(): Promise<void> {
    await this.page.clock.resume();
  }

  /** Every frame file written so far is on disk. */
  async flushed(): Promise<void> {
    await Promise.all(this.#writes);
  }

  async close(): Promise<void> {
    await Promise.all(this.#writes);
    await this.#browser.close();
    await this.#server.close();
  }
}
