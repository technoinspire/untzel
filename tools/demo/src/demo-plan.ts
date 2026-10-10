// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { toNumber, type InstrumentRegistry } from "@untzel/core";
import type { DemoScript } from "./actions";
import type { PacingOverrides } from "./demo-file";
import { featuredTracks } from "./script/featured-layers";
import { planTimeline, type Timeline } from "./pacing";
import { captureSeconds } from "./record/capture-length";
import { buildDemoScript } from "./script/script";
import { readTemplate } from "./script/template";

// The script and the timeline of a demo, fitted to the video: with the first track of each
// family built by hand, unless the capture would
// pass FIT_CAPTURE_SECONDS; then the last featured family joins the band, typed in the Code
// panel, until it fits or only MIN_FITTED_LAYERS are left. A demo file that names its
// featured tracks is planned as it says. Pure.

/** Under the 3:00 of a video, with room for the gestures that end after their planned frame. */
export const FIT_CAPTURE_SECONDS = 170;

/** The kick, the bass and the hats always get built by hand. */
export const MIN_FITTED_LAYERS = 3;

export interface DemoPlan {
  readonly script: DemoScript;
  readonly timeline: Timeline;
  /** The track names built by hand, in producer order. */
  readonly featured: readonly string[];
}

export interface DemoPlanOptions {
  readonly featured: readonly string[] | null;
  readonly pacing: PacingOverrides;
}

/** Null when the template does not play. */
export function planDemo(source: string, registry: InstrumentRegistry, options: DemoPlanOptions): DemoPlan | null {
  const read = readTemplate(source, registry);
  if (!read.ok) return null;
  const tempo = toNumber(read.template.program.tempo);
  const planWith = (names: readonly string[]): DemoPlan | null => {
    const built = buildDemoScript(source, registry, { featured: names });
    return built.ok ? { script: built.script, timeline: planTimeline(built.script, tempo, options.pacing), featured: names } : null;
  };
  const names = featuredTracks(read.template.tracks, options.featured).map((track) => track.track.name);
  if (options.featured !== null) return planWith(names);
  let plan = planWith(names);
  for (let count = names.length - 1; plan !== null && count >= MIN_FITTED_LAYERS && captureSeconds(plan.timeline) > FIT_CAPTURE_SECONDS; count -= 1) {
    plan = planWith(names.slice(0, count));
  }
  return plan;
}
