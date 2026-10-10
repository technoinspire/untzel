// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Simulation flags of the page. Development and test builds
// only: apps/web reads them behind import.meta.env checks, so a production build drops
// this module, and tools/budgets fails if the marker below reaches dist/.

export const PAGE_FLAGS_MARKER = "untzelPageFlags";

/** "webgpu" is still read and means WebGL2: the scene has one GPU level. */
export type ForcedRenderer = "webgl2" | "2d";

export interface PageFlags {
  /** ?sim=1: the fake session of apps/ui-preview instead of the engine. */
  readonly sim: boolean;
  /**
   * ?screen=<state>: A–G, desktop-track, desktop-code, collapsed, collapsed-code,
   * desktop-collapsed, load-failed, unsupported.
   */
  readonly screen: string | null;
  /** ?stress=<n>: n tracks (kick, hat, bass alternating) instead of the template. */
  readonly stress: number | null;
  /**
   * ?stressEngine=<instrument>: eight tracks of one instrument (the scale test's
   * per-engine line) instead of the template. Ignored when `stress` is set.
   */
  readonly stressEngine: string | null;
  /** ?renderer=webgl2|2d: forces a light fallback. */
  readonly renderer: ForcedRenderer | null;
  /** ?motion=reduce: the stage behaves as under prefers-reduced-motion. */
  readonly reducedMotion: boolean;
  /** ?seed=<n>: replaces the source hash that seeds "?" and rand. */
  readonly seed: number | null;
  /** ?template=<name>. */
  readonly template: string | null;
  /** ?still=1: freezes the fake transport at the wireframe's values. */
  readonly still: boolean;
  /** ?data=wireframe: the 9-track onboard of the wireframes. */
  readonly wireframe: boolean;
  /**
   * ?demo: the demo recorder's page (test build only):
   * an engine without sound on the virtual clock, and an empty text on the first tap.
   */
  readonly demo: boolean;
}

const MAX_STRESS_TRACKS = 256;

function positiveInteger(text: string | null, max: number): number | null {
  if (text === null || !/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= max ? value : null;
}

function renderer(text: string | null): ForcedRenderer | null {
  if (text === "webgpu" || text === "webgl2") return "webgl2";
  return text === "2d" ? text : null;
}

/** An instrument slug: lowercase letters, digits and hyphens, as the manifest names are. */
function instrumentName(text: string | null): string | null {
  return text !== null && /^[a-z0-9][a-z0-9-]*$/.test(text) ? text : null;
}

export function readPageFlags(search: string): PageFlags {
  const params = new URLSearchParams(search);
  const seed = params.get("seed");
  return {
    sim: params.get("sim") === "1",
    screen: params.get("screen"),
    stress: positiveInteger(params.get("stress"), MAX_STRESS_TRACKS),
    stressEngine: instrumentName(params.get("stressEngine")),
    renderer: renderer(params.get("renderer")),
    reducedMotion: params.get("motion") === "reduce",
    seed: seed !== null && /^\d+$/.test(seed) ? Number(seed) >>> 0 : null,
    template: params.get("template"),
    still: params.get("still") === "1",
    wireframe: params.get("data") === "wireframe",
    demo: params.has("demo"),
  };
}
