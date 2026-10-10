// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentManifest } from "@untzel/core";
import type { LayerRole } from "../actions";

// The order a producer builds a track in: kick, bass, hats and percussion,
// harmony, melody, voice, FX, then the arrangement. Tracks of the same role keep the
// order they have in the template.

const TRACK_ROLES: readonly LayerRole[] = ["kick", "bass", "percussion", "harmony", "melody", "voice", "fx"];

const VOICE_NAME = /vox|voice|vocal/;

/** The role of an instrument, from its manifest group and kind. */
export function roleOf(manifest: InstrumentManifest): LayerRole {
  if (VOICE_NAME.test(manifest.name)) return "voice";
  switch (manifest.group) {
    case "drums":
      return manifest.name === "kick" ? "kick" : "percussion";
    case "bass":
      return "bass";
    case "fx":
      return "fx";
    case "voices":
      return "voice";
    case "keys":
    case "plucks":
    case "pads":
    case "brass":
    case "leads":
      return manifest.kind === "chord" ? "harmony" : "melody";
  }
}

/** A stable sort of `items` by the producer order of their role. */
export function inProducerOrder<T>(items: readonly T[], manifestOf: (item: T) => InstrumentManifest): T[] {
  const rank = (item: T): number => TRACK_ROLES.indexOf(roleOf(manifestOf(item)));
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}
