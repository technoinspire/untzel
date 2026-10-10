// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { KeepOut } from "@untzel/scene";
import { Composer } from "../composer/composer";
import { STAGE_PRE_ROLL_S } from "../composer/feedback-schedule";
import { FrameBudget } from "./frame-budget";
import { FrameDriver } from "./frame-driver";
import { idleComposition } from "../composer/idle-scene";
import { MainThreadRelief } from "./main-thread-relief";
import type { HeardClock, LightPort, SceneStills, StageMode } from "../ports";
import { createCanvas2DRenderer } from "../renderers/canvas2d";
import type { RendererKind, StageRenderer } from "../renderers/renderer";
import { createWebGL2Renderer } from "../renderers/webgl2/webgl2";
import { StageStill } from "./stage-still";
// The live light stage: implements LightPort and draws, every animation frame,
// the instant being heard through the same FrameDriver the export uses. WebGL2 carries the
// scene; without it the 2D level draws the same primitives, and the music never stops.

export interface StageOptions {
  readonly host: HTMLElement;
  readonly clock: HeardClock;
  /** The brand zones and the top chrome, from the composition root. */
  readonly keepOut: KeepOut;
  /** Forces a level, for tests and the preview; default tries WebGL2, then 2D. */
  readonly prefer?: RendererKind;
  /** The page's effective reduced motion at mount; setReducedMotion follows it. */
  readonly reducedMotion: boolean;
  /** Called once with the level that was picked. */
  readonly onReady?: (kind: RendererKind) => void;
  readonly onError?: (error: unknown) => void;
}

export interface Stage extends LightPort, SceneStills {
  readonly kind: RendererKind | null;
  /** The menu's Reduced motion, without remounting the renderer. */
  setReducedMotion(isReduced: boolean): void;
  destroy(): void;
}

interface Picked {
  readonly renderer: StageRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly driver: FrameDriver;
}

/** Sharp on a retina screen without paying for 3×. */
export const MAX_DEVICE_PIXEL_RATIO = 2;
/** The stage's resolution under relief level 2 (main-thread-relief.ts). */
const RELIEF_RESOLUTION = 0.5;
const ORDER: Readonly<Record<RendererKind, readonly RendererKind[]>> = { webgl2: ["webgl2", "2d"], "2d": ["2d"] };

// Over 40 lines: the stage's frame loop; resize, tick and ready share the picked renderer and the frame state, and tick runs every animation frame.
export function createStage(options: StageOptions): Stage {
  let isReduced = options.reducedMotion;
  const composer = new Composer();
  const budget = new FrameBudget();
  const relief = new MainThreadRelief();
  let lastFrameAt: number | null = null;
  const stills = new StageStill(composer, () => isReduced);
  let mode: StageMode = "idle";
  let picked: Picked | null = null;
  let observer: ResizeObserver | null = null;
  let frame = 0;
  let resolution = 1;
  // The canvas's CSS size, read where layout is already done (the observer, a resize). Read
  // in the frame, after a batch of a playing song has written to the controls, it forced a
  // full layout of the page at every frame.
  let size = { width: 0, height: 0 };
  const resize = (): void => {
    if (picked === null) return;
    size = { width: picked.canvas.clientWidth, height: picked.canvas.clientHeight };
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO) * resolution;
    picked.renderer.resize(Math.max(1, Math.round(size.width * ratio)), Math.max(1, Math.round(size.height * ratio)));
  };
  const tick = (): void => {
    if (picked === null) return;
    const started = performance.now();
    const level = mode === "live" && lastFrameAt !== null ? relief.record(started - lastFrameAt) : relief.level;
    lastFrameAt = started;
    picked.driver.setRelief(level);
    // Read by the frame-time measurements; the canvas is aria-hidden.
    if (picked.canvas.dataset["relief"] !== String(level)) picked.canvas.dataset["relief"] = String(level);
    if (mode === "live") picked.driver.drawAt(options.clock.heardTime(), size);
    else picked.driver.drawStill(mode === "idle" ? idleComposition(started / 1000, isReduced) : null, size);
    // CPU time of the frame; GPU time is not observable without timestamp queries.
    const quality = budget.record(performance.now() - started);
    // Relief level 2 also lightens the GPU's share of the page's frame: the trail and bloom at
    // a quarter of the resolution, and the stage at half its resolution, at most.
    picked.driver.setLightFallback(quality.particleScale < 1 || level >= 2);
    const target = level >= 2 ? Math.min(quality.resolutionScale, RELIEF_RESOLUTION) : quality.resolutionScale;
    if (target !== resolution) {
      resolution = target;
      resize();
    }
    frame = window.requestAnimationFrame(tick);
  };
  const ready = (result: { readonly renderer: StageRenderer; readonly canvas: HTMLCanvasElement } | null): void => {
    if (result === null) return;
    const driver = new FrameDriver({ composer, renderer: result.renderer, keepOut: options.keepOut, isReduced, preRoll: STAGE_PRE_ROLL_S });
    picked = { ...result, driver };
    observer = new ResizeObserver(resize);
    observer.observe(result.canvas);
    resize();
    options.onReady?.(result.renderer.kind);
    frame = window.requestAnimationFrame(tick);
  };
  let destroyed = false;
  void pickRenderer(options.host, options.prefer ?? "webgl2", options.onError).then((result) => {
    if (destroyed) return result?.renderer.destroy();
    ready(result);
  }, options.onError);
  return {
    get kind() {
      return picked?.renderer.kind ?? null;
    },
    setProgram: (program) => composer.setProgram(program),
    setAudibility: (change) => composer.setAudibility(change),
    schedule: (cues, timeline) => composer.schedule(cues, timeline),
    setReducedMotion(next) {
      isReduced = next;
      picked?.driver.setReducedMotion(next);
    },
    still: (size, keepOut) =>
      picked === null ? Promise.resolve(null) : stills.draw({ ...size, keepOut, heardTime: mode === "live" ? options.clock.heardTime() : null, idleTime: performance.now() / 1000 }),
    setMode(next) {
      if (mode === "live" && next !== "live") {
        composer.clear();
        picked?.driver.resetTrail();
      }
      if (next === "live" && mode !== "live") {
        relief.reset();
        lastFrameAt = null;
      }
      mode = next;
    },
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      picked?.renderer.destroy();
      picked?.canvas.remove();
      stills.destroy();
    },
  };
}

/** A canvas keeps the first context type it was asked for, so each level gets its own. */
async function pickRenderer(host: HTMLElement, prefer: RendererKind, onError?: (error: unknown) => void): Promise<{ readonly renderer: StageRenderer; readonly canvas: HTMLCanvasElement } | null> {
  for (const kind of ORDER[prefer]) {
    const canvas = document.createElement("canvas");
    canvas.className = "untzel-stage";
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);
    const renderer = kind === "webgl2" ? createWebGL2Renderer(canvas, (message) => console.info(message)) : createCanvas2DRenderer(canvas);
    if (renderer !== null) return { renderer, canvas };
    if (kind === "webgl2") onError?.(new Error("WebGL2 is not available; the stage draws in 2D"));
    canvas.remove();
  }
  return null;
}
