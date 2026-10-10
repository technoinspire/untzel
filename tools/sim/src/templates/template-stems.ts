// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The stems of a template's main section for the club balance (./club-range): every track
// of the section played alone for the same 16 bars, through the same master, and its
// K-weighted power. A soloed track loses the kick's duck, as a solo in a DAW does. A
// template without sections plays every track, and each stem comments the others out.
import { LOOP_BARS } from "../render/golden";
import { familyOf, kWeightedPower, type StemPower } from "../measure/club-range";
import { simRegistry } from "../registry";
import { SAMPLE_RATE, runSource } from "../render/run";
import { withLoopSection } from "../render/sections";

const TRACK_LINE = /^([a-z][a-z0-9-]*):\s+([a-z][a-z0-9-]*)/;
const SECTION_LINE = /^(section\s+)([a-z][a-z0-9-]*)(\s+)([^|]*?)(\s*\|.*)?$/;

/** The track names of `section`, or of the whole text when `section` is null. */
export function sectionTracks(source: string, section: string | null): string[] {
  const lines = source.split("\n");
  if (section === null) return lines.flatMap((line) => TRACK_LINE.exec(line)?.[1] ?? []);
  const line = lines.map((entry) => SECTION_LINE.exec(entry)).find((match) => match?.[2] === section);
  return (line?.[4] ?? "").trim().split(/\s+/).filter((name) => name !== "");
}

/** The text that plays only `track` of `section` (null: of the sectionless text). */
export function soloText(source: string, section: string | null, track: string): string {
  if (section === null) {
    return source
      .split("\n")
      .map((line) => {
        const name = TRACK_LINE.exec(line)?.[1];
        return name !== undefined && name !== track ? `// ${line}` : line;
      })
      .join("\n");
  }
  return withLoopSection(source, section)
    .split("\n")
    .map((line) => {
      const match = SECTION_LINE.exec(line);
      return match?.[2] === section ? `${match[1]}${match[2]}${match[3]}${track}${match[5] ?? ""}` : line;
    })
    .join("\n");
}

/** The instrument of every track line. */
function instruments(source: string): Map<string, string> {
  return new Map(source.split("\n").flatMap((line) => {
    const match = TRACK_LINE.exec(line);
    return match === null ? [] : [[match[1]!, match[2]!] as const];
  }));
}

export function stemPowers(name: string, source: string, section: string | null, wasm: WebAssembly.Module): StemPower[] {
  const { registry } = simRegistry();
  const byTrack = instruments(source);
  return sectionTracks(source, section).flatMap((track) => {
    const instrument = byTrack.get(track);
    const manifest = instrument === undefined ? undefined : registry.get(instrument);
    if (instrument === undefined || manifest === undefined) return [];
    const result = runSource(soloText(source, section, track), { name, mode: "loop", seconds: null, bars: LOOP_BARS, tracks: null, seed: null, wasm, calibration: null, now: () => 0, trackRms: false });
    if (!result.ok || result.run.audio === null) throw new Error(`template ${name}: the stem ${track} does not render`);
    const from = result.run.startFrame ?? 0;
    const power = kWeightedPower(result.run.audio.left.subarray(from), result.run.audio.right.subarray(from), SAMPLE_RATE);
    return [{ track, instrument, family: familyOf(instrument, manifest.group), power }];
  });
}
