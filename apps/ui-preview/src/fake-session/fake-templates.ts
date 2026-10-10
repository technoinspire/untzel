// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The template picker of the simulated screens: a few styles of the real library, with
// the tempo and key their files declare (apps/web/src/templates/).

import type { TemplateCatalogView } from "@untzel/presentation/view-model";

export const FAKE_FIRST_TEMPLATE = "melodic-techno/midnight-bloom";

export const FAKE_TEMPLATES: TemplateCatalogView = {
  blank: { id: "blank", style: "", name: "Blank", summary: { bpm: 124, key: { tonic: 9, scale: "minor" } } },
  styles: [
    { id: "melodic-techno", label: "Melodic techno" },
    { id: "house", label: "House" },
    { id: "deep-house", label: "Deep house" },
    { id: "acid-techno", label: "Acid techno" },
  ],
  projects: [
    { id: FAKE_FIRST_TEMPLATE, style: "melodic-techno", name: "Midnight Bloom", summary: { bpm: 124, key: { tonic: 9, scale: "minor" } } },
    { id: "house/sunday-piano", style: "house", name: "Sunday Piano", summary: { bpm: 125, key: { tonic: 5, scale: "major" } } },
    { id: "house/disco-lights", style: "house", name: "Disco Lights", summary: { bpm: 118, key: { tonic: 7, scale: "major" } } },
    { id: "deep-house/night-garden", style: "deep-house", name: "Night Garden", summary: { bpm: 124, key: { tonic: 2, scale: "dorian" } } },
    { id: "acid-techno/warehouse", style: "acid-techno", name: "Warehouse", summary: { bpm: 138, key: { tonic: 5, scale: "minor" } } },
  ],
};
