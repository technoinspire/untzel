// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneSpec } from "@untzel/core";
// The seven categories and the scene an instrument of each one draws when its
// manifest declares none. Assumption on record: plucks are keys, brass is lead.

export type SceneCategory = "drums" | "bass" | "lead" | "pad" | "keys" | "voice" | "fx";

const CATEGORY_OF_GROUP: Readonly<Record<string, SceneCategory>> = {
  drums: "drums",
  bass: "bass",
  leads: "lead",
  brass: "lead",
  pads: "pad",
  keys: "keys",
  plucks: "keys",
  voices: "voice",
  fx: "fx",
};

const spec = (family: SceneSpec["family"], shape: SceneSpec["variant"]["shape"], drive: SceneSpec["drive"]): SceneSpec => ({
  family,
  variant: { shape, density: 2, tint: "track" },
  drive,
});

export const CATEGORY_DEFAULTS: Readonly<Record<SceneCategory, SceneSpec>> = {
  drums: spec("sparks", "needle", "attack"),
  bass: spec("floor", "band", "cutoff"),
  lead: spec("ribbon", "single", "cutoff"),
  pad: spec("fog", "cloud", "envelope"),
  keys: spec("bars", "keyboard", "pitch"),
  voice: spec("halo", "aura", "pitch"),
  fx: spec("sweep", "band", "cutoff"),
};

/** An unknown group draws as drums. */
export function categoryOf(group: string): SceneCategory {
  return CATEGORY_OF_GROUP[group] ?? "drums";
}
