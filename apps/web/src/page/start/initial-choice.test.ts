// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { discoverTemplates } from "@untzel/templates";
import { describe, expect, it } from "vitest";
import { initialChoice } from "./initial-choice";

const catalog = discoverTemplates({
  "house/style.json": '{ "label": "House", "order": 2 }',
  "house/disco-lights.untzel": "// template: Disco Lights\n// order: 2\ntempo 118\n",
  "melodic-techno/style.json": '{ "label": "Melodic techno", "order": 1 }',
  "melodic-techno/midnight-bloom.untzel": "// template: Midnight Bloom\n// order: 1\n// default: true\ntempo 124\n",
  "blank.untzel": "// template: Start from scratch\n// order: 0\ntempo 132\n",
});

describe("initialChoice", () => {
  const remembered = { template: "house/disco-lights", openStyle: "house" };

  it("opens on the first-touch template the first time", () => {
    expect(initialChoice(catalog, null, null, "phase1-onboard")).toEqual({ template: catalog.firstTouch, openStyle: null });
  });

  it("opens on the remembered choice while its template exists", () => {
    expect(initialChoice(catalog, null, remembered, "phase1-onboard")).toEqual(remembered);
    expect(initialChoice(catalog, null, { template: "house/gone", openStyle: "house" }, "phase1-onboard").template).toBe(catalog.firstTouch);
  });

  it("a ?template= the library has wins, and so does the test fixture and the blank template", () => {
    expect(initialChoice(catalog, "melodic-techno/midnight-bloom", remembered, "phase1-onboard").template).toBe("melodic-techno/midnight-bloom");
    expect(initialChoice(catalog, "phase1-onboard", null, "phase1-onboard").template).toBe("phase1-onboard");
    expect(initialChoice(catalog, "blank", null, "phase1-onboard").template).toBe("blank");
    expect(initialChoice(catalog, "nothing", remembered, "phase1-onboard")).toEqual(remembered);
  });
});
