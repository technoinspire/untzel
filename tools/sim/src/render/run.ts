// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// From a text to a report: analyze, simulate, measure. Used by the CLI, the golden files
// and their Vitest comparison.

import { LoadMeter, calibrationFromRuns, type Calibration } from "@untzel/audio/main";
import { toNumber, type Program } from "@untzel/core";
import { analyze, duplicateTrack, type Diagnostic } from "@untzel/language";
import type { PlaybackMode } from "@untzel/session";
import { simRegistry, type SimRegistry } from "../registry";
import { measureLoudness } from "../measure/loudness";
import {
  eventLines,
  eventsPerTrack,
  kickDrift,
  partRms,
  summarizeAudio,
  trackPreMaster,
  type SimulationReport,
  type TrackReport,
} from "./report";
import { simulate, type SimulationRun } from "./simulate";
import { stressSource } from "../stress";
import { VOICE_PACKS } from "./voice-packs";

export const SAMPLE_RATE = 48_000;
/** Above this many tracks the per-track solo renders are skipped (they cost one render each). */
export const SOLO_RMS_MAX_TRACKS = 16;
// Longer than the browser's 0.5 s: in Node the first runs also pay for the WASM tier-up,
// so a warm-up run comes first and is discarded.
const CALIBRATION_WARMUP_SECONDS = 2;
const CALIBRATION_EMPTY_SECONDS = 2;
const CALIBRATION_LOADED_SECONDS = 2;
const CALIBRATION_TRACKS = 24;

export interface RunOptions {
  readonly name: string;
  readonly mode: PlaybackMode;
  readonly seconds: number | null;
  readonly bars: number | null;
  /** Duplicate tracks until there are this many. */
  readonly tracks: number | null;
  /** Replaces the source hash that seeds "?" and rand. */
  readonly seed: number | null;
  readonly wasm: WebAssembly.Module | null;
  readonly calibration: Calibration | null;
  readonly now: () => number;
  /** false renders vox and choir on the formants, as before their packs arrive (--no-samples). */
  readonly samples?: boolean;
  /** --range 3-6, from the start or handed in after `rangeAtSeconds` of audio. */
  readonly range?: { readonly startBar: number; readonly endBar: number; readonly cycle: boolean } | null;
  readonly rangeAtSeconds?: number | null;
  /** false skips the per-track solo renders of the report (a caller that only wants the audio). */
  readonly trackRms?: boolean;
}

export type RunResult =
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }
  | {
      readonly ok: true;
      readonly program: Program;
      readonly run: SimulationRun;
      readonly report: SimulationReport;
      readonly events: string;
    };

/** Copies tracks (kick → kick2, …) in text order until the text has `count` tracks. */
export function withTrackCount(source: string, program: Program, count: number): string {
  let text = source;
  const originals = program.tracks.map((track) => track.name);
  for (let index = program.tracks.length; index < count; index += 1) {
    const original = originals[index % originals.length];
    if (original === undefined) break;
    const edit = duplicateTrack(text, original);
    if (!edit.ok) throw new Error(`duplicateTrack(${original}) failed: ${edit.reason}`);
    text = edit.source;
  }
  return text;
}

function analyzeWith(source: string, registry: SimRegistry, seed: number | null): RunResult | Program {
  const result = analyze(source, registry.registry);
  if (!result.ok) return { ok: false, diagnostics: result.diagnostics };
  return seed === null ? result.program : { ...result.program, sourceHash: seed >>> 0, seedDependent: true };
}

function secondsOf(program: Program, options: RunOptions): number {
  if (options.seconds !== null) return options.seconds;
  const bars = options.bars ?? 16;
  return (bars * 240) / toNumber(program.tempo);
}

function soloed(program: Program, name: string): Program {
  return { ...program, tracks: program.tracks.map((track) => ({ ...track, muted: track.name !== name })) };
}

/** Measures what the worklet costs here: an empty engine, then 8 instances of each instrument. */
export function calibrateInNode(wasm: WebAssembly.Module, now: () => number): Calibration {
  const registry = simRegistry();
  const names = registry.instruments.map((manifest) => manifest.name);
  const timing = (source: string, seconds: number) => {
    const result = analyze(source, registry.registry);
    if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? "calibration text");
    const run = simulate({ program: result.program, instruments: names, mode: "loop", sampleRate: SAMPLE_RATE, seconds, wasm, now, samplePacks: VOICE_PACKS });
    return { program: result.program, stats: run.stats, renderMs: run.dspMs, audioSeconds: run.frames / SAMPLE_RATE };
  };
  const loadedSource = stressSource(registry.instruments, CALIBRATION_TRACKS);
  timing(loadedSource, CALIBRATION_WARMUP_SECONDS);
  const empty = timing("tempo 132\n", CALIBRATION_EMPTY_SECONDS);
  const loaded = timing(loadedSource, CALIBRATION_LOADED_SECONDS);
  const meter = new LoadMeter(registry.instruments);
  if (loaded.stats === null) throw new Error("calibration render without stats");
  return calibrationFromRuns(empty, { ...loaded, units: meter.unitsOf(loaded.program, loaded.stats) });
}

// Over 40 lines: one simulated run, its solo renders and its report, built in one pass; the report literal is most of it.
export function runSource(source: string, options: RunOptions): RunResult {
  const registry = simRegistry();
  const names = registry.instruments.map((manifest) => manifest.name);
  let analyzed = analyzeWith(source, registry, options.seed);
  if ("ok" in analyzed) return analyzed;
  if (options.tracks !== null && options.tracks > analyzed.tracks.length) {
    analyzed = analyzeWith(withTrackCount(source, analyzed, options.tracks), registry, options.seed);
    if ("ok" in analyzed) return analyzed;
  }
  const program = analyzed;
  const seconds = secondsOf(program, options);
  const samplePacks = options.samples === false ? [] : VOICE_PACKS;
  const range = options.range ?? null;
  const rangeChange =
    range === null ? undefined : { atFrame: Math.round((options.rangeAtSeconds ?? 0) * SAMPLE_RATE), change: { mode: options.mode, range, locate: false } };
  const input = { instruments: names, mode: options.mode, sampleRate: SAMPLE_RATE, seconds, wasm: options.wasm, now: options.now, samplePacks, ...(rangeChange === undefined ? {} : { rangeChange }) };
  const run = simulate({ ...input, program });
  const counts = eventsPerTrack(run.events);
  const meter = new LoadMeter(registry.instruments);
  if (options.calibration !== null) meter.calibrate(options.calibration);
  const perUnit = options.calibration?.fractionPerUnit ?? null;
  const soloRms = options.wasm !== null && options.trackRms !== false && program.tracks.length <= SOLO_RMS_MAX_TRACKS;
  const startFrame = run.startFrame ?? 0;
  const tracks: Record<string, TrackReport> = {};
  for (const track of program.tracks) {
    const cost = registry.registry.get(track.instrument)?.costPerVoice ?? 0;
    const solo = soloRms ? simulate({ ...input, program: soloed(program, track.name) }).audio : null;
    tracks[track.name] = {
      instrument: track.instrument,
      events: counts.get(track.name) ?? 0,
      rmsDbfs: solo === null ? null : summarizeAudio(solo, startFrame).rmsDbfs,
      estimatedLoad: perUnit === null ? null : cost * averageVoices(run, track.name) * perUnit,
    };
  }
  const audioSeconds = run.frames / SAMPLE_RATE;
  const loudness =
    run.audio === null
      ? null
      : measureLoudness([run.audio.left.subarray(startFrame), run.audio.right.subarray(startFrame)], SAMPLE_RATE);
  const ticks = Math.max(1, Math.ceil(run.frames / Math.round(0.025 * SAMPLE_RATE)));
  const stats = run.stats;
  const report: SimulationReport = {
    name: options.name,
    mode: options.mode,
    sampleRate: SAMPLE_RATE,
    durationSeconds: (run.frames - startFrame) / SAMPLE_RATE,
    startFrame: run.startFrame,
    audio: run.audio === null ? null : summarizeAudio(run.audio, startFrame),
    tracks,
    kickDrift: kickDrift(run, program),
    counters:
      stats === null
        ? null
        : {
            lateDrops: stats.lateDrops,
            queueDrops: stats.queueDrops,
            nanResets: stats.nanResets,
            unknownTargets: stats.unknownTargets,
          },
    render: {
      dspMs: run.dspMs,
      transportMs: run.transportMs,
      realtimeFactor: run.dspMs / 1000 / audioSeconds,
      transportMsPerTick: run.transportMs / ticks,
    },
    estimatedLoad: estimatedLoad(meter, program, run, options.calibration),
    songEnded: run.ended,
    trackPreMaster: trackPreMaster(run.levels),
    loudnessLufs: loudness?.integratedLufs ?? null,
    shortTermMaxLufs: loudness?.shortTermMaxLufs ?? null,
    partRmsDbfs: partRms(run, program),
  };
  return { ok: true, program, run, report, events: eventLines(run) };
}

/** Average sounding voices of a track over the run, from the DSP's voiceFrames. */
function averageVoices(run: SimulationRun, track: string): number {
  const instance = run.stats?.instances.find((entry) => entry.name === track);
  return instance === undefined || run.frames <= 0 ? 0 : instance.voiceFrames / run.frames;
}

/** What the browser's meter would read for this run: the same units, the same calibration. */
function estimatedLoad(meter: LoadMeter, program: Program, run: SimulationRun, calibration: Calibration | null): number | null {
  if (calibration === null || run.stats === null) return null;
  return calibration.fixedFraction + meter.unitsOf(program, run.stats) * calibration.fractionPerUnit;
}

/** What makes `pnpm sim` exit non-zero. */
export function failures(report: SimulationReport): string[] {
  const reasons: string[] = [];
  if (report.audio !== null) {
    if (report.audio.nonFinite > 0) reasons.push(`${report.audio.nonFinite} NaN/inf samples`);
    if (report.audio.peakDbfs > 0) reasons.push(`peak ${report.audio.peakDbfs.toFixed(2)} dBFS above 0`);
    if (report.audio.clippedSamples > 0) reasons.push(`${report.audio.clippedSamples} samples at or above full scale`);
  }
  const drift = report.kickDrift.samples;
  if (drift !== null && drift >= 1) reasons.push(`kick drift ${drift} samples`);
  return reasons;
}
