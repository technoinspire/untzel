// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm sim --capacity <units>: 64 piano tracks play
// chords twice, once free and once with the CPU protection on a device that takes
// <units> of the meter. The protected run must keep its estimate near 100% or below,
// render no NaN, never go silent, and keep every track sounding (at least one voice).

import type { VoiceBudget } from "@untzel/audio/protocol";
import type { Program } from "@untzel/core";
import { analyze } from "@untzel/language";
import { summarizeAudio } from "../render/report";
import { simRegistry } from "../registry";
import { SAMPLE_RATE } from "../render/run";
import { simulate, type SimulationRun } from "../render/simulate";

const SECONDS = 6;
const TRACKS = 64;
/** The estimate may sit a little above 100% between two steps of the governor. */
const LOAD_TOLERANCE = 1.05;
const SILENCE_DBFS = -60;

/** 64 pianos playing four nine-note-wide chords a bar, at eight different gains. */
export function pianoWall(tracks = TRACKS): string {
  const lines = Array.from({ length: tracks }, (_, index) => `p${index + 1}: piano Cm9 Abmaj9 Fm9 G7 | gain ${(0.2 + (index % 8) * 0.1).toFixed(1)}`);
  return `tempo 124\nkey c minor\n${lines.join("\n")}\n`;
}

/** Mean meter units of a run: Σ voiceFrames × cost per voice ÷ frames. */
export function meanUnits(run: SimulationRun, program: Program, costOf: (instrument: string) => number): number {
  const instruments = new Map(program.tracks.map((track) => [track.name, track.instrument]));
  const frames = Math.max(1, run.frames);
  return (run.stats?.instances ?? []).reduce((sum, instance) => sum + (instance.voiceFrames * costOf(instruments.get(instance.name) ?? "")) / frames, 0);
}

export function checkGovernor(wasm: WebAssembly.Module, capacity: number, now: () => number): number {
  const { registry, instruments } = simRegistry();
  const result = analyze(pianoWall(), registry);
  if (!result.ok) {
    console.error(`sim --capacity: ${result.diagnostics[0]?.message ?? "invalid text"}`);
    return 2;
  }
  const program = result.program;
  const names = instruments.map((manifest) => manifest.name);
  const budget: VoiceBudget = { fixedFraction: 0, fractionPerUnit: 1 / capacity, costs: instruments.map((manifest) => manifest.costPerVoice) };
  const input = { program, instruments: names, mode: "loop" as const, sampleRate: SAMPLE_RATE, seconds: SECONDS, wasm, now };
  const free = simulate(input);
  const governed = simulate({ ...input, voiceBudget: budget });
  const costOf = (instrument: string): number => registry.get(instrument)?.costPerVoice ?? 0;
  const freeUnits = meanUnits(free, program, costOf);
  const governedUnits = meanUnits(governed, program, costOf);
  const audio = governed.audio === null ? null : summarizeAudio(governed.audio, governed.startFrame ?? 0);
  const silentTracks = (governed.stats?.instances ?? []).filter((instance) => instance.onsetCount === 0 || instance.voiceFrames === 0).length;
  console.log(`capacity ${capacity} units, ${TRACKS} piano tracks, ${SECONDS} s`);
  console.log(`  free:      mean ${freeUnits.toFixed(1)} units = ${(freeUnits / capacity).toFixed(3)} of the device`);
  console.log(`  protected: mean ${governedUnits.toFixed(1)} units = ${(governedUnits / capacity).toFixed(3)} of the device`);
  console.log(`  protected audio: rms ${audio?.rmsDbfs.toFixed(2) ?? "–"} dBFS · peak ${audio?.peakDbfs.toFixed(2) ?? "–"} dBFS · NaN/inf ${audio?.nonFinite ?? "–"} · tracks without a voice ${silentTracks}`);
  const problems = [
    governedUnits >= freeUnits ? "the protection did not lower the load" : null,
    governedUnits / capacity > LOAD_TOLERANCE ? `the protected load is above ${LOAD_TOLERANCE}` : null,
    audio === null || audio.nonFinite > 0 ? "NaN or no audio" : null,
    audio !== null && audio.rmsDbfs < SILENCE_DBFS ? "the protected render is silent" : null,
    silentTracks > 0 ? `${silentTracks} tracks lost every voice` : null,
  ].filter((problem): problem is string => problem !== null);
  for (const problem of problems) console.error(`sim --capacity FAIL: ${problem}`);
  if (problems.length > 0) return 1;
  console.log("sim --capacity PASS");
  return 0;
}
