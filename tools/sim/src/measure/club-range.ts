// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The club range of a template mix: the shape of the long-term spectrum against a club
// slope, and the
// K-weighted share of each family of tracks. Pure: spectra, stem powers and manifests in,
// numbers and violations out. A template's identity is its instruments, kit and
// arrangement (./template-kit), not a global EQ: this module only checks that every mix
// sits where a club track sits.
import type { InstrumentGroup } from "@untzel/core";
import { kWeighting } from "./loudness";
import { THIRD_OCTAVE_CENTERS } from "./ltas";
import { CLUB_OCTAVE_DELTA_MAX_DB, CLUB_TARGET_PSD_SLOPE, CLUB_TILT_RANGE, CLUB_TOP_SHARE_RANGE } from "../timbre/timbre-targets";

/** Octave centres whose deviation from the club line is checked (63 Hz to 8 kHz). */
export const CLUB_OCTAVES: readonly number[] = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
/** The octaves the slope is fitted through (125 Hz to 8 kHz). */
const FIT_FROM_HZ = 125;
/** Per-Hz power falls 3 dB per octave faster than the power of an octave band. */
const OCTAVE_BAND_TO_PSD = -3;

/** A family of tracks: the kick, the bass group, the cymbals, the other drums, a melodic group, fx. */
export type Family = "kick" | "bass" | "top" | "drums" | "fx" | MelodicGroup;
export type MelodicGroup = Exclude<InstrumentGroup, "drums" | "bass" | "fx">;
const TOP_INSTRUMENTS: ReadonlySet<string> = new Set(["hat", "shaker", "ride", "crash"]);

export function familyOf(instrument: string, group: InstrumentGroup): Family {
  if (instrument === "kick") return "kick";
  if (TOP_INSTRUMENTS.has(instrument)) return "top";
  return group;
}

export function isMelodic(family: Family): family is MelodicGroup {
  return family !== "kick" && family !== "bass" && family !== "top" && family !== "drums" && family !== "fx";
}

/** Octave band levels (dB) at CLUB_OCTAVES from third-octave bands (dB): three thirds per octave. */
export function octaveLevelsDb(thirdsDb: readonly number[]): number[] {
  return CLUB_OCTAVES.map((centre) => {
    const index = THIRD_OCTAVE_CENTERS.findIndex((third) => Math.abs(third / centre - 1) < 0.05);
    const power = [index - 1, index, index + 1].reduce((sum, i) => sum + 10 ** ((thirdsDb[i] ?? -300) / 10), 0);
    return 10 * Math.log10(power + 1e-30);
  });
}

export interface ClubShape {
  /** Per-Hz slope over 125 Hz to 8 kHz, dB per octave. */
  readonly psdTiltDbPerOctave: number;
  /** Each octave's level minus the club line (slope CLUB_TARGET_PSD_SLOPE, offset fitted). */
  readonly octaveDeltasDb: readonly number[];
  /** RMS of the deltas: the deviation from the target. */
  readonly deviationDb: number;
}

export function clubShape(thirdsDb: readonly number[]): ClubShape {
  const levels = octaveLevelsDb(thirdsDb);
  const xs = CLUB_OCTAVES.map((centre) => Math.log2(centre / 1000));
  const fit = CLUB_OCTAVES.map((centre, i) => ({ x: xs[i]!, y: levels[i]! })).filter((_, i) => CLUB_OCTAVES[i]! >= FIT_FROM_HZ);
  const meanX = fit.reduce((sum, point) => sum + point.x, 0) / fit.length;
  const meanY = fit.reduce((sum, point) => sum + point.y, 0) / fit.length;
  const covariance = fit.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const variance = fit.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const bandSlope = CLUB_TARGET_PSD_SLOPE - OCTAVE_BAND_TO_PSD;
  const offset = meanY - bandSlope * meanX;
  const octaveDeltasDb = levels.map((level, i) => level - (offset + bandSlope * xs[i]!));
  const deviationDb = Math.sqrt(octaveDeltasDb.reduce((sum, delta) => sum + delta * delta, 0) / octaveDeltasDb.length);
  return { psdTiltDbPerOctave: covariance / variance + OCTAVE_BAND_TO_PSD, octaveDeltasDb, deviationDb };
}

/** Mean K-weighted power (BS.1770) of a stereo stem, both channels summed. */
export function kWeightedPower(left: Float32Array, right: Float32Array, sampleRate: number): number {
  const stages = kWeighting(sampleRate);
  let total = 0;
  for (const channel of [left, right]) {
    let input: Float64Array = Float64Array.from(channel);
    for (const { b0, b1, b2, a1, a2 } of stages) {
      const out = new Float64Array(input.length);
      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;
      for (let n = 0; n < input.length; n += 1) {
        const x = input[n]!;
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        out[n] = y;
      }
      input = out;
    }
    total += input.reduce((sum, value) => sum + value * value, 0) / Math.max(1, input.length);
  }
  return total;
}

/** One track of the main section, played alone. */
export interface StemPower {
  readonly track: string;
  readonly instrument: string;
  readonly family: Family;
  /** K-weighted power. */
  readonly power: number;
}

export interface ClubBalance {
  /** Share of the summed K-weighted power per family, dB, loudest first. */
  readonly familySharesDb: readonly { readonly family: Family; readonly shareDb: number }[];
  /** The loudest track and its share, dB. */
  readonly loudest: { readonly track: string; readonly shareDb: number } | null;
  /** Melodic tracks louder than the kick family. */
  readonly melodicOverKick: readonly string[];
}

const shareDb = (power: number, total: number): number => 10 * Math.log10(Math.max(power, 1e-30) / Math.max(total, 1e-30));

/** The sum of the stems stands in for the mix (stems are mostly uncorrelated). */
export function clubBalance(stems: readonly StemPower[]): ClubBalance {
  const total = stems.reduce((sum, stem) => sum + stem.power, 0);
  const families = new Map<Family, number>();
  for (const stem of stems) families.set(stem.family, (families.get(stem.family) ?? 0) + stem.power);
  const familySharesDb = [...families].map(([family, power]) => ({ family, shareDb: shareDb(power, total) })).sort((a, b) => b.shareDb - a.shareDb);
  const loudestStem = [...stems].sort((a, b) => b.power - a.power)[0];
  const kick = families.get("kick") ?? 0;
  return {
    familySharesDb,
    loudest: loudestStem === undefined ? null : { track: loudestStem.track, shareDb: shareDb(loudestStem.power, total) },
    melodicOverKick: stems.filter((stem) => isMelodic(stem.family) && stem.power > kick).map((stem) => stem.track),
  };
}

/** Every club rule the template breaks, one line each. */
export function clubViolations(template: string, shape: ClubShape, balance: ClubBalance): string[] {
  const out: string[] = [];
  const [lowTilt, highTilt] = CLUB_TILT_RANGE;
  if (shape.psdTiltDbPerOctave < lowTilt || shape.psdTiltDbPerOctave > highTilt) {
    out.push(`${template}: PSD tilt ${shape.psdTiltDbPerOctave.toFixed(2)} dB/oct outside ${lowTilt}..${highTilt}`);
  }
  shape.octaveDeltasDb.forEach((delta, i) => {
    if (Math.abs(delta) > CLUB_OCTAVE_DELTA_MAX_DB) out.push(`${template}: ${CLUB_OCTAVES[i]} Hz is ${delta.toFixed(1)} dB off the club line (at most ±${CLUB_OCTAVE_DELTA_MAX_DB})`);
  });
  const topTwo = balance.familySharesDb.slice(0, 2).map((entry) => entry.family);
  if (!topTwo.includes("kick") || !topTwo.includes("bass")) out.push(`${template}: the two loudest families are ${topTwo.join(" and ")}, not kick and bass`);
  for (const track of balance.melodicOverKick) out.push(`${template}: the melodic track ${track} is louder than the kick`);
  const top = balance.familySharesDb.find((entry) => entry.family === "top")?.shareDb ?? -Infinity;
  const [lowTop, highTop] = CLUB_TOP_SHARE_RANGE;
  if (top < lowTop || top > highTop) out.push(`${template}: hats, shaker and ride take ${top.toFixed(1)} dB of the loudness, outside ${lowTop}..${highTop}`);
  return out;
}
