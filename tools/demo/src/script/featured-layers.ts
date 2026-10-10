// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { LayerRole } from "../actions";
import { inProducerOrder, roleOf } from "./producer-order";
import type { TemplateTrack } from "./template";

// The layers a demo builds by hand: the first track of each family, in producer order
// (kick, bass, hats and percussion, harmony, melody, then a
// voice or else an FX), six at most. A demo file may name its own instead. Every other
// track goes in through the Code panel, so a template of any size fits the video. Pure.

/** At most this many layers are built gesture by gesture. */
export const MAX_FEATURED_LAYERS = 6;

/** The families, in producer order; the last one takes a voice, or an FX when there is none. */
const FAMILIES: readonly (readonly LayerRole[])[] = [["kick"], ["bass"], ["percussion"], ["harmony"], ["melody"], ["voice", "fx"]];

function firstOfFamily(tracks: readonly TemplateTrack[], family: readonly LayerRole[]): TemplateTrack | null {
  for (const role of family) {
    const found = tracks.find((track) => roleOf(track.manifest) === role);
    if (found !== undefined) return found;
  }
  return null;
}

/**
 * The featured tracks of a template, in producer order: the demo file's `chosen` names when
 * it has them, else the first track of each family. A chosen name the template does not
 * have is a programming error here: the demo file is checked against the template first.
 */
export function featuredTracks(tracks: readonly TemplateTrack[], chosen: readonly string[] | null): readonly TemplateTrack[] {
  const ordered = inProducerOrder(tracks, (track) => track.manifest);
  if (chosen !== null) {
    const unknown = chosen.filter((name) => !tracks.some((track) => track.track.name === name));
    if (unknown.length > 0) throw new RangeError(`featured tracks not in the template: ${unknown.join(", ")}`);
    return ordered.filter((track) => chosen.includes(track.track.name));
  }
  const picked = FAMILIES.flatMap((family) => {
    const track = firstOfFamily(ordered, family);
    return track === null ? [] : [track];
  });
  return picked.slice(0, MAX_FEATURED_LAYERS);
}
