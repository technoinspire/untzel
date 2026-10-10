// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The light stage loads in the background: until it is ready the stage is the static
// background colour, and the first paint does not wait for WebGL. Reduced motion comes
// from the page's one source and follows the menu's switch without a remount.
import { createStage, type RendererKind } from "@untzel/light";
import type { MotionSetting } from "../page/motion-setting";
import type { LightRelay } from "../page/light-relay";
import { stageKeepOut } from "./stage-keep-out";

export interface StageMountOptions {
  readonly prefer: RendererKind | null;
  readonly motion: MotionSetting;
}

export function mountStage(host: HTMLElement, relay: LightRelay, options: StageMountOptions): void {
  const stage = createStage({
    host,
    clock: relay.clock,
    keepOut: stageKeepOut(),
    ...(options.prefer === null ? {} : { prefer: options.prefer }),
    reducedMotion: options.motion.isReduced(),
    onReady: (kind) => (document.documentElement.dataset["renderer"] = kind),
    onError: (error) => console.warn("Untzel stage fell back:", error),
  });
  options.motion.onChange(() => stage.setReducedMotion(options.motion.isReduced()));
  relay.attach(stage);
}
