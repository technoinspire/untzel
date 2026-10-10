// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { fileURLToPath } from "node:url";
import { simRegistry } from "@untzel/sim/registry";
import { readTemplateTree, templateFiles } from "@untzel/sim/template-tree";
import { describe, expect, it } from "vitest";
import { FIT_CAPTURE_SECONDS, MIN_FITTED_LAYERS, planDemo } from "./demo-plan";
import { featuredTracks } from "./script/featured-layers";
import { captureSeconds } from "./record/capture-length";
import { readTemplate } from "./script/template";

const { registry } = simRegistry();
const catalog = readTemplateTree(fileURLToPath(new URL("../../../", import.meta.url)));
const templates = templateFiles(catalog)
  .filter((template) => template.id !== "blank")
  .map((template) => [template.id, template.text] as const);

function familyFirsts(source: string): string[] {
  const read = readTemplate(source, registry);
  if (!read.ok) throw new Error("the template must play");
  return featuredTracks(read.template.tracks, null).map((track) => track.track.name);
}

describe("planDemo", () => {
  it.each(templates)("%s: fits the video, dropping featured families from the end only", (_, source) => {
    const plan = planDemo(source, registry, { featured: null, pacing: {} });
    if (plan === null) throw new Error("the template must play");
    const firsts = familyFirsts(source);
    expect(firsts.slice(0, plan.featured.length)).toEqual(plan.featured);
    const fits = captureSeconds(plan.timeline) <= FIT_CAPTURE_SECONDS;
    expect(fits || plan.featured.length === MIN_FITTED_LAYERS).toBe(true);
    if (plan.featured.length < firsts.length) {
      // One more family would not have fit.
      const longer = planDemo(source, registry, { featured: firsts.slice(0, plan.featured.length + 1), pacing: {} });
      expect(captureSeconds(longer?.timeline ?? plan.timeline)).toBeGreaterThan(FIT_CAPTURE_SECONDS);
    }
  });
  it("plans the featured tracks a demo file names as they are, even past the fit", () => {
    const source = templates.find(([id]) => id === "indie-dance/coastline")?.[1] ?? "";
    const firsts = familyFirsts(source);
    const plan = planDemo(source, registry, { featured: firsts, pacing: {} });
    expect(plan?.featured).toEqual(firsts);
  });
  it("refuses a text that does not play", () => {
    expect(planDemo("kick x... | drive 9\n", registry, { featured: null, pacing: {} })).toBeNull();
  });
});
