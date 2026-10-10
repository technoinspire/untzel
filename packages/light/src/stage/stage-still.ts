// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { KeepOut } from "@untzel/scene";
import type { Composer } from "../composer/composer";
import { STAGE_PRE_ROLL_S } from "../composer/feedback-schedule";
import { FrameDriver } from "./frame-driver";
import { idleComposition } from "../composer/idle-scene";
import { createCanvas2DRenderer } from "../renderers/canvas2d";
import type { StageRenderer } from "../renderers/renderer";
import { createWebGL2Renderer } from "../renderers/webgl2/webgl2";
// A still of the live scene at a file's size: the Export sheet's preview shows
// what the file will hold. The live stage's composer, a FrameDriver of its own (its own
// trail and limiter, rolled from the pre-roll) and the same renderer as the stage and the
// export, on an OffscreenCanvas kept for the next still and shrunk to 1 × 1 between them.

export interface StillRequest {
  readonly width: number;
  readonly height: number;
  readonly keepOut: KeepOut;
  /** The instant being heard, or null when the music is stopped: the idle fog. */
  readonly heardTime: number | null;
  /** Seconds for the idle fog's drift. */
  readonly idleTime: number;
}

export class StageStill {
  readonly #composer: Composer;
  /** The page's reduced motion at the moment of the still. */
  readonly #isReduced: () => boolean;
  #canvas: OffscreenCanvas | null = null;
  #renderer: StageRenderer | null = null;

  constructor(composer: Composer, isReduced: () => boolean) {
    this.#composer = composer;
    this.#isReduced = isReduced;
  }

  async draw(request: StillRequest): Promise<Blob | null> {
    const renderer = this.#rendererFor(request);
    if (renderer === null || this.#canvas === null) return null;
    const isReduced = this.#isReduced();
    const driver = new FrameDriver({ composer: this.#composer, renderer, keepOut: request.keepOut, isReduced, preRoll: STAGE_PRE_ROLL_S });
    const size = { width: request.width, height: request.height };
    if (request.heardTime === null) driver.drawStill(idleComposition(request.idleTime, isReduced), size);
    else driver.drawAt(request.heardTime, size);
    const blob = await this.#canvas.convertToBlob({ type: "image/png" });
    renderer.resize(1, 1);
    return blob;
  }

  destroy(): void {
    this.#renderer?.destroy();
    this.#renderer = null;
    this.#canvas = null;
  }

  #rendererFor(request: StillRequest): StageRenderer | null {
    if (typeof OffscreenCanvas === "undefined") return null;
    this.#canvas ??= new OffscreenCanvas(request.width, request.height);
    this.#renderer ??= createWebGL2Renderer(this.#canvas) ?? createCanvas2DRenderer(this.#canvas);
    this.#renderer?.resize(request.width, request.height);
    this.#renderer?.clearTrail();
    return this.#renderer;
  }
}
