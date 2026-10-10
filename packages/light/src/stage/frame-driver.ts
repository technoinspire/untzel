// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { CORE_CENTRE_Y, skyAtmosphereLine, type KeepOut } from "@untzel/scene";
import { paletteAt } from "@untzel/scene/palette";
import { EMPTY_COMPOSITION, type Composer, type Composition, type CompositionDetail } from "../composer/composer";
import type { ReliefLevel } from "./main-thread-relief";
import { partialStep, trailSteps, type TrailStep } from "../composer/feedback-schedule";
import { FlashLimiter, linearChannel } from "../safety/flash-limiter";
import { LimiterClock } from "../safety/limiter-clock";
import { frameLuminance } from "../safety/luminance";
import { postSettings } from "../safety/post-light";
import { MASK_FEATHER } from "../renderers/mask-shape";
import type { DrawnFrame, StageMask, StageRenderer, TrailWarp } from "../renderers/renderer";
import { fitScene, placeOnStage, sceneSquare, type SceneSquare, type StageSize } from "../composer/scene-fit";
// The one path from the composer to the pixels, shared by the live stage and the
// export: the same trail grid, the same limiter clock, the same passes and the same map
// from u to the stage. The video is the screen because there is no second path.


export interface FrameDriverOptions {
  readonly composer: Composer;
  readonly renderer: StageRenderer;
  readonly keepOut: KeepOut;
  readonly isReduced: boolean;
  /** Seconds of trail the driver rebuilds after a jump (the stage 0.5 s, the export 1 s). */
  readonly preRoll: number;
}

export class FrameDriver {
  readonly #options: FrameDriverOptions;
  readonly #limiter: LimiterClock;
  #lastStep: TrailStep | null = null;
  #palettes = new Map<number, Float32Array>();
  #isLightFallback = false;
  #isReduced: boolean;
  #relief: ReliefLevel = 0;

  constructor(options: FrameDriverOptions) {
    this.#options = options;
    this.#isReduced = options.isReduced;
    const post = postSettings(options.isReduced, false, 1);
    this.#limiter = new LimiterClock(new FlashLimiter({ reducedMotion: options.isReduced }), post.bloom, post.hasTrail);
  }

  /**
   * The menu's Reduced motion turned while the light plays: the limiter,
   * the bloom and the trail follow it from the next frame. The trail is rebuilt from the
   * pre-roll, as after a jump, so a switch back to full motion does not draw a stale trail.
   */
  setReducedMotion(isReduced: boolean): void {
    if (isReduced === this.#isReduced) return;
    this.#isReduced = isReduced;
    const post = postSettings(isReduced, false, 1);
    this.#limiter.setReducedMotion(isReduced, post.bloom, post.hasTrail);
    this.resetTrail();
  }

  /** The light fallback: the trail and bloom at a quarter of the resolution, the same look. */
  setLightFallback(isLightFallback: boolean): void {
    this.#isLightFallback = isLightFallback;
  }

  /**
   * The stage's relief of the main thread (main-thread-relief.ts); a file never relieves.
   * Level 1 drops the light versions; level 2 also draws the limiter's last step instead of
   * composing the frame's instant again, and turns the trail off, as reduced motion does.
   */
  setRelief(level: ReliefLevel): void {
    if (level >= 2 && this.#relief < 2) this.resetTrail();
    this.#relief = level;
  }

  /** Draws the instant t on a stage of `size`. Instants must not go back in time. */
  drawAt(t: number, size: StageSize): Composition {
    const { composer, renderer } = this.#options;
    const isReduced = this.#isReduced;
    const square = sceneSquare(fitScene(size));
    const detail: CompositionDetail = this.#relief >= 1 ? "full-layers-only" : "full";
    const drawsTrail = !isReduced && this.#relief < 2;
    const step: { composition: Composition | null } = { composition: null };
    const limited = this.#limiter.advanceTo(t, (time) => {
      step.composition = composer.composeAt(time, isReduced, detail);
      return frameLuminance(step.composition, time);
    });
    // Level 2: the limiter's last step is at most 1/120 s before t; the frame shows it.
    const latest = this.#relief >= 2 && step.composition !== null ? step.composition : composer.composeAt(t, isReduced, detail);
    if (drawsTrail) this.#runTrail(t, square, latest, detail);
    const warp = !drawsTrail || this.#lastStep === null ? null : this.#warp(partialStep(this.#lastStep, t), latest, square);
    renderer.present(this.#frame(latest, square), warp, postSettings(isReduced, this.#isLightFallback, limited.output));
    composer.prune(t);
    return latest;
  }

  /** A composition outside the music (the idle fog, or nothing): no trail, no limiter, base light only. */
  drawStill(composition: Composition | null, size: StageSize): void {
    const square = sceneSquare(fitScene(size));
    const still = composition ?? EMPTY_COMPOSITION;
    this.#options.renderer.present(this.#frame(still, square), null, postSettings(this.#isReduced, this.#isLightFallback, 1));
  }

  /** Forget the trail: the next frame rebuilds it from the pre-roll. */
  resetTrail(): void {
    this.#lastStep = null;
    this.#options.renderer.clearTrail();
  }

  #runTrail(t: number, square: SceneSquare, latest: Composition, detail: CompositionDetail): void {
    const { composer, renderer, preRoll } = this.#options;
    const isReduced = this.#isReduced;
    const from = this.#lastStep === null || t - this.#lastStep.time > preRoll ? t - preRoll : this.#lastStep.time;
    if (this.#lastStep === null || t - this.#lastStep.time > preRoll) renderer.clearTrail();
    for (const step of trailSteps(composer.clock, from, t, latest.stagePlanHash)) {
      const composition = composer.composeAt(step.time, isReduced, detail);
      renderer.stepTrail(this.#frame(composition, square), this.#warp(step, composition, square));
      this.#lastStep = step;
    }
  }

  #warp(step: TrailStep, composition: Composition, square: SceneSquare): TrailWarp {
    return { centerX: composition.coreX * square.unit, centerY: CORE_CENTRE_Y * square.unit, zoom: step.zoom, turn: step.turn, decay: step.decay };
  }

  #frame(composition: Composition, square: SceneSquare): DrawnFrame {
    const line = skyAtmosphereLine(this.#options.keepOut);
    const { sky } = composition;
    return {
      primitives: composition.primitives.map((primitive) => placeOnStage(primitive, square)),
      atmosphere: line === null || sky.level <= 0 ? null : { lineY: line * square.unit, level: sky.level * (1 + sky.breath), color: sky.color, flow: composition.flow },
      palette: this.#palette(composition.paletteShift),
      unit: square.unit,
      mask: this.#mask(square),
    };
  }

  #mask(square: SceneSquare): StageMask {
    const { unit } = square;
    const { brandZones, topY, frameHasChrome } = this.#options.keepOut;
    return {
      boxes: brandZones.map((zone) => ({ minX: zone.minX * unit, maxX: zone.maxX * unit, minY: zone.minY * unit, maxY: zone.maxY * unit })),
      // Only the page masks the chrome band: its top bar covers it. A file has no bar, so the
      // scene's light and the sky's haze run through the line without a dark seam.
      topY: frameHasChrome ? topY * unit : null,
      feather: MASK_FEATHER * unit,
    };
  }

  #palette(shift: number): Float32Array {
    const cached = this.#palettes.get(shift);
    if (cached !== undefined) return cached;
    const linear = new Float32Array(paletteAt(shift).flatMap((color) => [linearChannel(color.r * 255), linearChannel(color.g * 255), linearChannel(color.b * 255)]));
    this.#palettes.set(shift, linear);
    return linear;
  }
}
