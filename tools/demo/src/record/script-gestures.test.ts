// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Every template's script becomes gestures, with no action left without one,
// in plan order, on the desktop and on the phone.
import { fileURLToPath } from "node:url";
import { simRegistry } from "@untzel/sim/registry";
import { readTemplateTree, templateFiles } from "@untzel/sim/template-tree";
import { describe, expect, it } from "vitest";
import type { DemoActionKind } from "../actions";
import { planDemo } from "../demo-plan";
import { FakePage } from "./fake-page";
import { GESTURES, perform } from "./gestures";
import { plannedActions } from "./perform-plan";

const { registry } = simRegistry();
const catalog = readTemplateTree(fileURLToPath(new URL("../../../../", import.meta.url)));
const templates = templateFiles(catalog)
  .filter((template) => template.id !== "blank")
  .map((template) => [template.id, template.text] as const);

const KINDS: readonly DemoActionKind[] = [
  "addTrack",
  "renameTrack",
  "setStepCount",
  "setTrackBars",
  "toggleStep",
  "setStepNote",
  "setParameter",
  "setMute",
  "setLoopBars",
  "addSectionMember",
  "typeCode",
  "togglePlay",
  "setMode",
  "drop",
];

describe("GESTURES", () => {
  it("has one gesture for each of the 14 action kinds, and nothing else", () => {
    expect(Object.keys(GESTURES).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) expect(typeof GESTURES[kind]).toBe("function");
  });
});

describe.each([false, true])("every template's plan as gestures (phone: %s)", (isPhone) => {
  it.each(templates)("%s", async (_, source) => {
    const plan = planDemo(source, registry, { featured: null, pacing: {} });
    if (plan === null) throw new Error("the template must play");
    const planned = plannedActions(plan.timeline, registry);
    expect(planned.map((entry) => entry.index)).toEqual(planned.map((_, index) => index));
    for (const entry of planned) {
      const page = new FakePage();
      await perform(page, entry.action, { source: entry.before, registry, isPhone });
      expect(page.calls.length, `action ${entry.index} (${entry.action.kind}) made no gesture`).toBeGreaterThan(0);
    }
  });
});
