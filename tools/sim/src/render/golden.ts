// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Golden files: the schedule (events.txt) and a rounded sound summary of every template,
// in loop and song mode. Any change to the sound or the timing shows up as a diff.
// No WAV is stored: the summary is what review needs, and it stays small in git.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import type { PlaybackMode } from "@untzel/session";
import { runSource } from "./run";
import { readTemplateTree, templateFiles } from "../templates/template-tree";

export const GOLDEN_DIR = "tools/sim/golden";
/** Compatibility texts that are not templates (the phase 1 onboard, the library). */
export const FIXTURE_DIR = "tools/sim/fixtures";
export const LOOP_BARS = 16;

export interface GoldenRun {
  readonly bars: number;
  readonly events: number;
  readonly eventsPerTrack: Readonly<Record<string, number>>;
  readonly songEnded: boolean;
  /** null when computed without the DSP. */
  readonly sound: {
    readonly peakDbfs: number;
    readonly rmsDbfs: number;
    readonly nonFinite: number;
    readonly clippedSamples: number;
    readonly kickDriftSamples: number | null;
    readonly trackRmsDbfs: Readonly<Record<string, number | null>>;
  } | null;
}

export interface GoldenTemplate {
  readonly name: string;
  readonly summary: {
    readonly template: string;
    readonly runs: { readonly loop: GoldenRun; readonly song?: GoldenRun };
  };
  readonly events: { readonly loop: string; readonly song?: string };
}

const round = (value: number): number => Math.round(value * 100) / 100;

function untzelFiles(repo: string, dir: string): { readonly name: string; readonly source: string }[] {
  return readdirSync(join(repo, dir))
    .filter((file) => file.endsWith(".untzel"))
    .sort()
    .map((file) => ({ name: basename(file, ".untzel"), source: readFileSync(join(repo, dir, file), "utf8") }));
}

/**
 * Every template, named by its id ("house/disco-lights", so its golden files sit in
 * golden/house/), then every fixture: each one has golden files.
 */
export function templates(repo: string): { readonly name: string; readonly source: string }[] {
  const library = templateFiles(readTemplateTree(repo)).map((template) => ({ name: template.id, source: template.text }));
  return [...library, ...untzelFiles(repo, FIXTURE_DIR)];
}

export function songBars(source: string): number {
  // The whole song plus one bar, so the end of a song without "| loop" is in the file.
  const song = /^song\s+(.+)$/m.exec(source)?.[1] ?? "";
  const bars = [...song.matchAll(/(\d+)\s*(,|\||$)/g)].reduce((sum, match) => sum + Number(match[1]), 0);
  return bars === 0 ? LOOP_BARS : bars + 1;
}

/** A loop template (no section) has no song run. */
export function modesOf(source: string): readonly PlaybackMode[] {
  return /^section\s/m.test(source) ? ["loop", "song"] : ["loop"];
}

/** `modes` narrows the runs (the Vitest sound check renders the loop only). */
export function goldenOf(name: string, source: string, wasm: WebAssembly.Module | null, modes: readonly PlaybackMode[] = modesOf(source)): GoldenTemplate {
  const runs: Partial<Record<PlaybackMode, GoldenRun>> = {};
  const events: Partial<Record<PlaybackMode, string>> = {};
  for (const mode of modes) {
    const bars = mode === "loop" ? LOOP_BARS : songBars(source);
    const result = runSource(source, { name, mode, seconds: null, bars, tracks: null, seed: null, wasm, calibration: null, now: () => performance.now() });
    if (!result.ok) throw new Error(`${name}: ${result.diagnostics[0]?.message ?? "invalid template"}`);
    const { report } = result;
    const tracks = Object.entries(report.tracks);
    runs[mode] = {
      bars,
      events: tracks.reduce((sum, [, track]) => sum + track.events, 0),
      eventsPerTrack: Object.fromEntries(tracks.map(([track, value]) => [track, value.events])),
      songEnded: report.songEnded,
      sound:
        report.audio === null
          ? null
          : {
              peakDbfs: round(report.audio.peakDbfs),
              rmsDbfs: round(report.audio.rmsDbfs),
              nonFinite: report.audio.nonFinite,
              clippedSamples: report.audio.clippedSamples,
              kickDriftSamples: report.kickDrift.samples,
              trackRmsDbfs: Object.fromEntries(
                tracks.map(([track, value]) => [track, value.rmsDbfs === null ? null : round(value.rmsDbfs)]),
              ),
            },
    };
    events[mode] = result.events;
  }
  const loop = runs.loop;
  const loopEvents = events.loop;
  if (loop === undefined || loopEvents === undefined) throw new Error(`${name}: no loop run`);
  return {
    name,
    summary: { template: name, runs: runs.song === undefined ? { loop } : { loop, song: runs.song } },
    events: events.song === undefined ? { loop: loopEvents } : { loop: loopEvents, song: events.song },
  };
}

function files(repo: string, name: string): { summary: string; loop: string; song: string } {
  const dir = join(repo, GOLDEN_DIR);
  return {
    summary: join(dir, `${name}.summary.json`),
    loop: join(dir, `${name}.loop.events.txt`),
    song: join(dir, `${name}.song.events.txt`),
  };
}

export function serializeSummary(golden: GoldenTemplate): string {
  return `${JSON.stringify(golden.summary, null, 2)}\n`;
}

export function readGolden(repo: string, name: string, withSong = true): { summary: string; loop: string; song: string | undefined } {
  const paths = files(repo, name);
  return {
    summary: readFileSync(paths.summary, "utf8"),
    loop: readFileSync(paths.loop, "utf8"),
    song: withSong ? readFileSync(paths.song, "utf8") : undefined,
  };
}

export function writeGolden(repo: string, wasm: WebAssembly.Module): number {
  mkdirSync(join(repo, GOLDEN_DIR), { recursive: true });
  for (const { name, source } of templates(repo)) {
    const golden = goldenOf(name, source, wasm);
    const paths = files(repo, name);
    mkdirSync(dirname(paths.summary), { recursive: true });
    writeFileSync(paths.summary, serializeSummary(golden));
    writeFileSync(paths.loop, golden.events.loop);
    if (golden.events.song !== undefined) writeFileSync(paths.song, golden.events.song);
    const song = golden.summary.runs.song?.events;
    console.log(`sim:golden updated ${name} (${golden.summary.runs.loop.events}${song === undefined ? "" : ` + ${song}`} events)`);
  }
  console.log("sim:golden PASS: golden files written; review the diff before committing.");
  return 0;
}

/** First differing line, for a readable failure. */
export function firstDifference(expected: string, actual: string): string | null {
  if (expected === actual) return null;
  const a = expected.split("\n");
  const b = actual.split("\n");
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return `line ${index + 1}: expected "${a[index] ?? "<end>"}", got "${b[index] ?? "<end>"}"`;
  }
  return "differs";
}

export function checkGolden(repo: string, wasm: WebAssembly.Module): number {
  let failed = 0;
  for (const { name, source } of templates(repo)) {
    const golden = goldenOf(name, source, wasm);
    let stored;
    try {
      stored = readGolden(repo, name, golden.events.song !== undefined);
    } catch {
      console.error(`sim:golden FAIL: ${name} has no golden files; run pnpm sim:golden --update`);
      failed += 1;
      continue;
    }
    const checks: [string, string, string][] = [
      ["summary", stored.summary, serializeSummary(golden)],
      ["loop events", stored.loop, golden.events.loop],
    ];
    if (golden.events.song !== undefined) checks.push(["song events", stored.song ?? "", golden.events.song]);
    for (const [label, expected, actual] of checks) {
      const difference = firstDifference(expected, actual);
      if (difference === null) continue;
      console.error(`sim:golden FAIL: ${name} ${label}, ${difference}`);
      failed += 1;
    }
  }
  if (failed > 0) {
    console.error("If the change is intended: pnpm sim:golden --update, then review the diff.");
    return 1;
  }
  console.log("sim:golden PASS: every template matches its golden files.");
  return 0;
}
