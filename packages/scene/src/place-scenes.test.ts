// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { parseManifest, type InstrumentManifest } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { boxArea, floorWings } from "./floor-wings";
import { TOP_CHROME_KEEP_OUT_Y, distanceToBox } from "./keep-out";
import { overlapShare, placeScenes } from "./place-scenes";
import { stagePlan, type StagePlan } from "./stage-plan";
import { MEASURED_BRAND_ZONES, MEASURED_KEEP_OUT, describeProduction, productionTracks, stressTracks } from "./testing/productions";

const ROOT = new URL("../../../", import.meta.url);
const manifests = new Map<string, InstrumentManifest>(
  readdirSync(new URL("instruments/", ROOT)).flatMap((name) => {
    try {
      const result = parseManifest(JSON.parse(readFileSync(new URL(`instruments/${name}/manifest.json`, ROOT), "utf8")));
      return result.ok ? [[result.manifest.name, result.manifest] as const] : [];
    } catch {
      return [];
    }
  }),
);
const template = (id: string): string => readFileSync(new URL(`apps/web/src/templates/${id}.untzel`, ROOT), "utf8");
const PRODUCTIONS = ["melodic-techno/midnight-bloom", "afro-house/red-earth", "indie-dance/coastline", "psytrance/full-moon"].map((id) =>
  describeProduction(productionTracks(template(id)), manifests, 7),
);
const STRESS = describeProduction(stressTracks([...manifests.keys()].sort()), manifests, 7);
/** One plan per arrangement: the four stages a production can get. */
const PLANS: readonly StagePlan[] = [0, 1, 2, 3].map((arrangement) => ({
  ...stagePlan(arrangement + 11),
  arrangement,
  isMirrored: (arrangement & 1) === 1,
  isCoreOffset: (arrangement & 2) === 2,
}));

describe("placeScenes", () => {
  it.each(PLANS.map((plan) => [plan.arrangement, plan] as const))("places every track, inside the square, arrangement %i", (_, plan) => {
    for (const production of [...PRODUCTIONS, STRESS]) {
      const anchors = placeScenes(production, plan, MEASURED_KEEP_OUT);
      expect(anchors.size).toBe(production.length);
      for (const [track, anchor] of anchors) {
        expect(Math.abs(anchor.x), track).toBeLessThanOrEqual(1);
        expect(Math.abs(anchor.y), track).toBeLessThanOrEqual(1);
        if (!anchor.spansWidth) expect(anchor.y - anchor.reachY, track).toBeGreaterThanOrEqual(TOP_CHROME_KEEP_OUT_Y - 1e-9);
      }
    }
  });

  it("keeps every anchor and every floor cell out of the brand zones, in the four arrangements", () => {
    for (const plan of PLANS) {
      for (const production of [...PRODUCTIONS, STRESS]) {
        for (const [track, anchor] of placeScenes(production, plan, MEASURED_KEEP_OUT)) {
          for (const zone of MEASURED_BRAND_ZONES) {
            if (anchor.band !== null) expect(distanceToBox(anchor.x, anchor.y, zone) - anchor.band.to, track).toBeGreaterThan(0);
            else if (!anchor.spansWidth) {
              const box = { minX: anchor.x - anchor.reachX, maxX: anchor.x + anchor.reachX, minY: anchor.y - anchor.reachY, maxY: anchor.y + anchor.reachY };
              const touches = box.minX < zone.maxX && box.maxX > zone.minX && box.minY < zone.maxY && box.maxY > zone.minY;
              expect(touches, `${track} in ${anchor.zone}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it("lets members of a zone share at most 20 % of their space", () => {
    for (const production of [...PRODUCTIONS, STRESS]) {
      const anchors = [...placeScenes(production, PLANS[0] as StagePlan, MEASURED_KEEP_OUT).values()];
      for (const a of anchors) for (const b of anchors) if (a !== b && a.zone === b.zone) expect(overlapShare(a, b)).toBeLessThanOrEqual(0.2);
    }
  });

  it("does not depend on the order of the tracks", () => {
    const production = PRODUCTIONS[1] ?? [];
    const plan = PLANS[2] as StagePlan;
    expect(placeScenes([...production].reverse(), plan, MEASURED_KEEP_OUT)).toEqual(placeScenes(production, plan, MEASURED_KEEP_OUT));
  });

  it("an edit of one line moves no other track", () => {
    const production = PRODUCTIONS[0] ?? [];
    const plan = PLANS[1] as StagePlan;
    const before = placeScenes(production, plan, MEASURED_KEEP_OUT);
    const edited = production.map((description, index) => (index === 0 ? { ...description, sceneSeed: description.sceneSeed ^ 1 } : description));
    expect(placeScenes(edited, plan, MEASURED_KEEP_OUT)).toEqual(before);
  });

  it("stops the right floor wing before the 16:9 corner mark", () => {
    const [left, right] = floorWings(MEASURED_BRAND_ZONES);
    expect(left).toEqual({ minX: -0.98, maxX: -0.62, minY: 0.5, maxY: 0.94 });
    expect(right.maxX).toBeCloseTo(0.7845, 9);
    expect(boxArea(left)).toBeGreaterThan(0.05);
    expect(boxArea(right)).toBeGreaterThan(0.05);
  });
});
