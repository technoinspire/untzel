// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm sim --levels: every instrument plays its
// preview in a loop for 8 s with every named sound, and the level of the track before the
// master (trackPreMaster) is checked by kind. Pitched and chord: a peak of −3 dBFS or
// lower (headroom, so gain is never eaten by the master), and an RMS between −22 and −16
// dBFS unless the headroom is what stops it (a sparse, percussive sound may sit lower
// when its peak is already within 3 dB of −3). Drum and fx: a peak between −9 and −3 dBFS.
// hat and bass keep their original voices and levels (exempt; they pass the gain null test of
// pnpm sim --gain with the gentler master compressor). The kick's default sound is the
// original one and the reference; its other named sounds were redesigned and sit
// around it: a peak at or under −1 dBFS and an RMS within ±1.5 dB of the reference, unless
// the peak is what stops it (a short kick already within 1.5 dB of the ceiling). It also is
// the audible check of each instrument: the WAV of every default sound is written to
// .cache/sim/levels/.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InstrumentKind, InstrumentManifest } from "@untzel/core";
import { SAMPLE_RATE, failures, runSource } from "../render/run";
import { simRegistry } from "../registry";
import { encodeWav } from "@untzel/export/wav";

const SECONDS = 8;
const BASE_TEXT = "tempo 124\nkey c minor\n";
/** hat and bass keep their original level until they get a redesign of their own. */
export const LEVEL_EXEMPT: ReadonlySet<string> = new Set(["hat", "bass"]);
/** The kick's named sounds are judged against its default. */
export const KICK = "kick";
/** No other kick sound peaks above this before the master (the default kick's punch: −0.79). */
export const KICK_PEAK_CEILING = -1;
/** A kick sound's RMS stays within this of the reference's. */
export const KICK_RMS_WINDOW_DB = 1.5;
/** A short kick whose peak is within this of the ceiling may stay under the RMS window. */
const KICK_PEAK_BOUND_DB = 1.5;
export const RMS_RANGE: readonly [number, number] = [-22, -16];
export const PEAK_RANGE: readonly [number, number] = [-9, -3];
/** No sound peaks above this before the master. */
export const PEAK_CEILING = -3;
/** A sound whose peak is within this of the ceiling may stay under the RMS window. */
const HEADROOM_BOUND_DB = 3;

export interface SoundLevel {
  readonly instrument: string;
  readonly kind: InstrumentKind;
  readonly preset: string;
  readonly rmsDbfs: number;
  readonly peakDbfs: number;
  readonly problem: string | null;
}

/** The text of one sound: the preset word only when it is not the default. */
export function soundText(manifest: InstrumentManifest, preset: string): string {
  const word = preset === manifest.defaultPreset ? "" : ` ${preset}`;
  return `${BASE_TEXT}p: ${manifest.name}${word} ${manifest.preview}\n`;
}

/** The level rule for one measured sound; null when it passes, is exempt or is a kick. */
export function levelProblem(instrument: string, kind: InstrumentKind, rmsDbfs: number, peakDbfs: number): string | null {
  if (LEVEL_EXEMPT.has(instrument) || instrument === KICK) return null;
  if (peakDbfs > PEAK_CEILING) return `peak ${peakDbfs.toFixed(1)} dBFS above ${PEAK_CEILING}`;
  if (kind === "pitched" || kind === "chord") {
    const [low, high] = RMS_RANGE;
    const headroomBound = peakDbfs >= PEAK_CEILING - HEADROOM_BOUND_DB;
    if (rmsDbfs > high || (rmsDbfs < low && !headroomBound)) return `RMS ${rmsDbfs.toFixed(1)} dBFS outside ${low}..${high}`;
    return null;
  }
  const [low, high] = PEAK_RANGE;
  return peakDbfs < low || peakDbfs > high ? `peak ${peakDbfs.toFixed(1)} dBFS outside ${low}..${high}` : null;
}

/** The level rule for a kick sound that is not the reference; null when it passes. */
export function kickLevelProblem(rmsDbfs: number, peakDbfs: number, referenceRmsDbfs: number): string | null {
  if (peakDbfs > KICK_PEAK_CEILING) return `peak ${peakDbfs.toFixed(1)} dBFS above ${KICK_PEAK_CEILING}`;
  const low = referenceRmsDbfs - KICK_RMS_WINDOW_DB;
  const high = referenceRmsDbfs + KICK_RMS_WINDOW_DB;
  const peakBound = peakDbfs >= KICK_PEAK_CEILING - KICK_PEAK_BOUND_DB;
  if (rmsDbfs > high || (rmsDbfs < low && !peakBound)) {
    return `RMS ${rmsDbfs.toFixed(1)} dBFS outside ${low.toFixed(1)}..${high.toFixed(1)} (the default kick ± ${KICK_RMS_WINDOW_DB})`;
  }
  return null;
}

/** Judges every kick sound against the default one, which is the reference. */
export function withKickRule(levels: readonly SoundLevel[], defaultKick: string): SoundLevel[] {
  const reference = levels.find((level) => level.instrument === KICK && level.preset === defaultKick);
  if (reference === undefined) return [...levels];
  return levels.map((level) =>
    level.instrument !== KICK || level === reference || level.problem !== null
      ? level
      : { ...level, problem: kickLevelProblem(level.rmsDbfs, level.peakDbfs, reference.rmsDbfs) },
  );
}

/** The verdict column: the problem, or why the sound passes. */
function verdictOf(level: SoundLevel, defaultKick: string): string {
  if (level.problem !== null) return level.problem;
  if (LEVEL_EXEMPT.has(level.instrument)) return "exempt";
  return level.instrument === KICK && level.preset === defaultKick ? "reference" : "ok";
}

// Over 40 lines: the --levels measurement and its table, in the order the command prints them.
export function measureLevels(repo: string, wasm: WebAssembly.Module, now: () => number): number {
  const { instruments, registry } = simRegistry();
  const defaultKick = registry.get(KICK)?.defaultPreset ?? "";
  const dir = join(repo, ".cache", "sim", "levels");
  mkdirSync(dir, { recursive: true });
  const measured: SoundLevel[] = [];
  let broken = 0;
  for (const manifest of instruments) {
    for (const preset of manifest.presets) {
      const result = runSource(soundText(manifest, preset.name), { name: "levels", mode: "loop", seconds: SECONDS, bars: null, tracks: null, seed: null, wasm, calibration: null, now });
      if (!result.ok) throw new Error(`levels: ${manifest.name} ${preset.name}: ${result.diagnostics[0]?.message ?? "invalid text"}`);
      const level = result.report.trackPreMaster.p;
      const rmsDbfs = level?.rmsDbfs ?? -Infinity;
      const peakDbfs = level?.peakDbfs ?? -Infinity;
      const failed = failures(result.report);
      if (failed.length > 0) broken += 1;
      measured.push({
        instrument: manifest.name,
        kind: manifest.kind,
        preset: preset.name,
        rmsDbfs,
        peakDbfs,
        problem: failed.length > 0 ? failed.join("; ") : levelProblem(manifest.name, manifest.kind, rmsDbfs, peakDbfs),
      });
      if (preset.name === manifest.defaultPreset && result.run.audio !== null) {
        const { left, right } = result.run.audio;
        const from = result.run.startFrame ?? 0;
        writeFileSync(join(dir, `${manifest.name}.wav`), encodeWav(left.subarray(from), right.subarray(from), SAMPLE_RATE));
      }
    }
  }
  const levels = withKickRule(measured, defaultKick);
  console.log(`levels: ${instruments.length} instruments, ${levels.length} sounds, ${SECONDS} s of the preview each, before the master`);
  console.log("instrument   | kind    | sound        | RMS dBFS | peak dBFS | rule");
  console.log("------------ | ------- | ------------ | -------- | --------- | ----");
  for (const level of levels) {
    const verdict = verdictOf(level, defaultKick);
    console.log(
      `${level.instrument.padEnd(12)} | ${level.kind.padEnd(7)} | ${level.preset.padEnd(12)} | ${level.rmsDbfs.toFixed(2).padStart(8)} | ${level.peakDbfs.toFixed(2).padStart(9)} | ${verdict}`,
    );
  }
  writeFileSync(join(repo, ".cache", "sim", "levels.json"), `${JSON.stringify({ seconds: SECONDS, levels }, null, 2)}\n`);
  const outside = levels.filter((level) => level.problem !== null);
  console.log(`→ ${dir} (WAV of every default sound) and levels.json`);
  if (outside.length > 0 || broken > 0) {
    console.error(`sim --levels FAIL: ${outside.length} of ${levels.length} sounds outside the level rule or broken`);
    return 1;
  }
  console.log("sim --levels PASS");
  return 0;
}
