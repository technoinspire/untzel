// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentManifest } from "@untzel/core";
import { chooseScene, type SceneDescription } from "../choose-scene";
import type { ExclusionBox, KeepOut } from "../keep-out";
import { screenKeepOut } from "../keep-out";
// Test fixtures: a production's track lines read the simple way (name, instrument, pan) and
// turned into descriptions with the real manifests. The tests read the files themselves.

export interface ProductionTrack {
  readonly name: string;
  readonly instrument: string;
  readonly pan: number;
}

const TRACK_LINE = /^([a-z][a-z0-9_-]*):\s+([a-z][a-z0-9-]*)/;
const PAN = /\|\s*pan\s+(-?[\d.]+)/;

export function productionTracks(text: string): readonly ProductionTrack[] {
  return text.split("\n").flatMap((line) => {
    const track = TRACK_LINE.exec(line);
    if (track === null) return [];
    const pan = PAN.exec(line);
    return [{ name: track[1] ?? "", instrument: track[2] ?? "", pan: pan === null ? 0 : Number(pan[1]) }];
  });
}

export function describeProduction(
  tracks: readonly ProductionTrack[],
  manifests: ReadonlyMap<string, InstrumentManifest>,
  lightSourceHash: number,
): readonly SceneDescription[] {
  return tracks.map((track) => {
    const manifest = manifests.get(track.instrument);
    if (manifest === undefined) throw new Error(`no manifest for ${track.instrument}`);
    return chooseScene(manifest, track, { lightSourceHash });
  });
}

/** The two brand zones measured from the export's brandLayout; export's own test checks them. */
export const MEASURED_BRAND_ZONES: readonly ExclusionBox[] = [
  { minX: 0.7845, maxX: 1.9668, minY: 0.5729, maxY: 1.0409 },
  { minX: -0.5911, maxX: 0.5911, minY: 0.7757, maxY: 1.2437 },
];

export const MEASURED_KEEP_OUT: KeepOut = screenKeepOut(MEASURED_BRAND_ZONES);

/** 64 tracks over every instrument, for the load tests. */
export function stressTracks(instruments: readonly string[]): readonly ProductionTrack[] {
  return Array.from({ length: 64 }, (_, index) => ({
    name: `t${index}`,
    instrument: instruments[index % instruments.length] ?? "kick",
    pan: ((index % 9) - 4) / 4,
  }));
}
