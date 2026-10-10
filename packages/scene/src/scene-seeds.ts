// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { fnv1a32, mix, mulberry32 } from "@untzel/core";
// The light's seeds. Changing a formula or
// a salt changes the animation of every shared link: it is a breaking change.
//   lookSeed  = mix(fnv1a32(trackName), fnv1a32(instrument), 0x100C, 0)  the track's own look
//   sceneSeed = mix(lightSourceHash, fnv1a32(trackName), 0x5C3E, 0)      per-event draws
//   event     = mulberry32(mix(sceneSeed, bar, tick, familySalt))

export const LOOK_SALT = 0x100c;
export const SCENE_SALT = 0x5c3e;

/** Depends on the track's own name and instrument only: editing another line never moves it. */
export function lookSeed(trackName: string, instrument: string): number {
  return mix(fnv1a32(trackName), fnv1a32(instrument), LOOK_SALT, 0);
}

/** The owner's seed: the session text (without `| mute`) plus the track's name. */
export function sceneSeed(lightSourceHash: number, trackName: string): number {
  return mix(lightSourceHash, fnv1a32(trackName), SCENE_SALT, 0);
}

/** The draws of one event: the same bar and tick of the same text always give the same sparks. */
export function eventRandom(seed: number, bar: number, tick: number, salt: number): () => number {
  return mulberry32(mix(seed, bar >>> 0, tick >>> 0, salt));
}
