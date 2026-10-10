// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { discoverTemplates } from "@untzel/templates";
import { describe, expect, it } from "vitest";
import { templateCatalogView } from "./template-catalog-view";

const catalog = discoverTemplates({
  "house/style.json": '{ "label": "House", "order": 2 }',
  "house/disco-lights.untzel": "// template: Disco Lights\n// order: 2\ntempo 118\n",
  "melodic-techno/style.json": '{ "label": "Melodic techno", "order": 1 }',
  "melodic-techno/midnight-bloom.untzel": "// template: Midnight Bloom\n// order: 1\n// default: true\ntempo 124\n",
  "blank.untzel": "// template: Start from scratch\n// order: 0\ntempo 132\n",
});

describe("templateCatalogView", () => {
  it("lists the styles and projects without their texts, with a summary when there is one", () => {
    const view = templateCatalogView(catalog, { "house/disco-lights": { bpm: 118, key: { tonic: 7, scale: "major" } } });
    expect(view.styles).toEqual([{ id: "melodic-techno", label: "Melodic techno" }, { id: "house", label: "House" }]);
    expect(view.projects).toEqual([
      { id: "melodic-techno/midnight-bloom", style: "melodic-techno", name: "Midnight Bloom", summary: null },
      { id: "house/disco-lights", style: "house", name: "Disco Lights", summary: { bpm: 118, key: { tonic: 7, scale: "major" } } },
    ]);
  });
});
