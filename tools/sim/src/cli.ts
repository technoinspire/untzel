// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm sim <file.untzel> [--bars N | --seconds S] [--tracks N] [--out dir] [--seed S] [--mode loop|song]
//          [--section <name|all>] [--rounds N] [--clock wall|cpu] [--no-samples]
//          [--range A-B [--range-at S] [--cycle off]]   (play range)
// pnpm sim --scale | --costs | --levels | --gain | --capacity <units>   [--clock wall|cpu]
// pnpm sim --timbre [--fail-closed] [--only a,b] [--out file.json] | --templates [--out dir]
// pnpm sim --take <take.json> [--from-arm] [--out file.wav]   (a take: the Export
//          sheet's WAV, or from the arm the sound track of a video with the closing card)
// pnpm sim:golden [--update]
// Exit codes: 0 pass, 1 a measured failure (NaN, clipped samples, peak above 0 dBFS,
// drift ≥ 1 sample, golden difference, a take that does not replay) or a mode the text
// cannot play (--mode song without a song: one line, no stack trace), 2 bad input
// (diagnostics, missing WASM, bad arguments, an unreadable or refused take).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import type { Calibration } from "@untzel/audio/main";
import type { Diagnostic } from "@untzel/language";
import { UsageError, parseArguments, type Arguments } from "./cli-arguments";
import { clockOf } from "./render/clock";
import { measureCosts } from "./measure/costs";
import { checkGain } from "./measure/gain-checks";
import { checkGovernor } from "./measure/governor-check";
import { measureLevels } from "./measure/levels";
import { checkGolden, songBars, writeGolden } from "./render/golden";
import { checkBoundaries } from "./measure/range-check";
import { runSections } from "./render/sections";
import type { SimulationReport } from "./render/report";
import { SAMPLE_RATE, calibrateInNode, failures, runSource, type RunResult } from "./render/run";
import { PlayRefused } from "./render/simulate";
import { runScale } from "./measure/scale";
import { TEMPLATE_DIR, readTemplateTree, templateFiles } from "./templates/template-tree";
import { writeTemplateRenders } from "./templates/template-identity";
import { runTake, takeOutFile } from "./take/take-command";
import { runTimbre } from "./timbre/timbre-report";
import { VOICE_PACKS } from "./render/voice-packs";
import { encodeWav } from "@untzel/export/wav";

export { parseArguments } from "./cli-arguments";
export { SCALE_TRACKS, withinDesignTolerance } from "./measure/scale";

export interface Paths {
  readonly repo: string;
  readonly wasm: string;
}

function loadWasm(paths: Paths): WebAssembly.Module {
  try {
    return new WebAssembly.Module(readFileSync(paths.wasm));
  } catch {
    throw new UsageError(`no DSP at ${paths.wasm}: run pnpm build:wasm (pnpm check builds it when Rust changed)`);
  }
}

/** "file:line:col: error CODE message", 1-based. */
export function formatDiagnostic(file: string, source: string, diagnostic: Diagnostic): string {
  const before = source.slice(0, diagnostic.from);
  const line = before.split("\n").length;
  const column = diagnostic.from - before.lastIndexOf("\n");
  return `${file}:${line}:${column}: ${diagnostic.severity} ${diagnostic.code} ${diagnostic.message}`;
}

function fixed(value: number | null | undefined, digits: number): string {
  return value === null || value === undefined ? "–" : value.toFixed(digits);
}

/** A template id (`house/disco-lights`, `blank`) is that template's file; anything else is a path. */
export function templateFile(repo: string, argument: string): string {
  if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/.test(argument)) return resolve(argument);
  const ids = templateFiles(readTemplateTree(repo)).map((template) => template.id);
  if (!ids.includes(argument)) throw new UsageError(`no template ${argument}; the templates are ${ids.join(", ")}`);
  return join(repo, TEMPLATE_DIR, `${argument}.untzel`);
}

/** A mode the text cannot play is one line and exit 1, never a stack trace. */
function runFile(args: Arguments, paths: Paths, calibration: Calibration, wasm: WebAssembly.Module, now: () => number): number {
  try {
    return renderFile(args, paths, calibration, wasm, now);
  } catch (error) {
    if (!(error instanceof PlayRefused)) throw error;
    const shown = args.file ?? "";
    console.error(error.code === "SONG_UNAVAILABLE" ? `sim: ${shown} has no song (${error.code})` : `sim: ${shown} cannot play ${error.mode} (${error.code})`);
    return 1;
  }
}

function renderFile(args: Arguments, paths: Paths, calibration: Calibration, wasm: WebAssembly.Module, now: () => number): number {
  const file = templateFile(paths.repo, args.file ?? "");
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    throw new UsageError(`cannot read ${args.file ?? file}`);
  }
  const name = basename(file, extname(file)) + (args.tracks === null ? "" : `-${args.tracks}tracks`);
  if (args.section !== null) return runSections(source, name, args.section, { bars: args.bars ?? 16, rounds: args.rounds, wasm, calibration, now });
  // Song mode with no length renders the whole song plus one bar.
  const bars = args.mode === "song" && args.bars === null && args.seconds === null ? songBars(source) : args.bars;
  const result = runSource(source, { name, mode: args.mode, seconds: args.seconds, bars, tracks: args.tracks, seed: args.seed, wasm, calibration, now, samples: args.samples, range: args.range, rangeAtSeconds: args.rangeAt });
  if (!result.ok) {
    for (const diagnostic of result.diagnostics) console.error(formatDiagnostic(args.file ?? file, source, diagnostic));
    console.error(`sim FAIL: ${result.diagnostics.length} diagnostic(s) in ${args.file ?? file}`);
    return 2;
  }
  const out = resolve(args.out ?? join(paths.repo, ".cache", "sim", name));
  writeRun(out, result);
  printReport(name, result.report);
  if (args.range !== null) checkRange(out, args, result);
  console.log(`  → ${out}`);
  return verdict(result.report);
}

type FinishedRun = Extract<RunResult, { ok: true }>;

/** audio.wav from the start frame, events.txt and report.json. */
function writeRun(out: string, { run, events, report }: FinishedRun): void {
  mkdirSync(out, { recursive: true });
  if (run.audio !== null) {
    const from = run.startFrame ?? 0;
    const wav = encodeWav(run.audio.left.subarray(from), run.audio.right.subarray(from), SAMPLE_RATE);
    writeFileSync(join(out, "audio.wav"), wav);
  }
  writeFileSync(join(out, "events.txt"), events);
  writeFileSync(join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

function printReport(name: string, report: SimulationReport): void {
  const tracks = Object.values(report.tracks);
  console.log(
    `${name}: ${report.mode}, ${report.durationSeconds.toFixed(2)} s at ${SAMPLE_RATE} Hz, ${tracks.length} tracks, ${tracks.reduce((sum, track) => sum + track.events, 0)} events`,
  );
  console.log(
    `  peak ${fixed(report.audio?.peakDbfs, 2)} dBFS · rms ${fixed(report.audio?.rmsDbfs, 2)} dBFS · NaN/inf ${report.audio?.nonFinite ?? "–"} · clipped ${report.audio?.clippedSamples ?? "–"}`,
  );
  console.log(
    `  kick drift ${report.kickDrift.samples ?? `– (${report.kickDrift.note ?? ""})`} · render ${report.render.dspMs.toFixed(0)} ms · realtime factor ${report.render.realtimeFactor.toFixed(4)} · estimated load ${fixed(report.estimatedLoad, 4)}`,
  );
  console.log(`  loudness ${fixed(report.loudnessLufs, 1)} LUFS integrated · ${fixed(report.shortTermMaxLufs, 1)} LUFS short-term max`);
  if (report.partRmsDbfs.length > 0) {
    console.log(`  parts: ${report.partRmsDbfs.map((part) => `${part.section} ${fixed(part.rmsDbfs, 1)}`).join(" · ")} (dBFS RMS)`);
  }
  console.log("  track          instrument   events  pre-master RMS  peak (dBFS)");
  for (const [track, levels] of Object.entries(report.trackPreMaster)) {
    const info = report.tracks[track];
    console.log(
      `  ${track.padEnd(14)} ${(info?.instrument ?? "").padEnd(12)} ${String(info?.events ?? 0).padStart(6)}  ${fixed(levels.rmsDbfs, 2).padStart(14)}  ${fixed(levels.peakDbfs, 2).padStart(11)}`,
    );
  }
}

/** The play range's bar lines: said, and kept in range-check.json. */
function checkRange(out: string, args: Arguments, { run, report }: FinishedRun): void {
  if (args.range === null || run.audio === null) return;
  const check = checkBoundaries(run.audio, run.startFrame ?? 0, SAMPLE_RATE, run.tempo[0]?.bpm ?? 132, Math.floor((report.durationSeconds * (run.tempo[0]?.bpm ?? 132)) / 240));
  const at = args.rangeAt === null ? "from the start" : `handed in at ${args.rangeAt} s`;
  console.log(`  range bars ${args.range.startBar}–${args.range.endBar} (${args.range.cycle ? "cycle" : "cycle off"}, ${at}): largest step at a bar line ${check.maxBoundaryStep.toFixed(4)} · mid-bar ${check.maxMidStep.toFixed(4)} · quietest 50 ms ${fixed(check.quietestWindowDbfs, 1)} dBFS`);
  writeFileSync(join(out, "range-check.json"), `${JSON.stringify({ range: args.range, rangeAt: args.rangeAt, ...check }, null, 2)}\n`);
}

/** Exit code of a finished run: 1 when the report fails a pass condition (see `failures`), else 0. */
export function verdict(report: SimulationReport): number {
  const reasons = failures(report);
  if (reasons.length > 0) {
    console.error(`sim FAIL: ${reasons.join("; ")}`);
    return 1;
  }
  console.log("sim PASS");
  return 0;
}

/** The default path of the timbre matrix (report (d)). */
export const TIMBRE_REPORT = ".cache/sim/timbre.json";

/** The default folder of the template renders, for listening. */
export const TEMPLATE_RENDERS = ".cache/sound-design/now";

/** A take renders asynchronously (the export's WAV writer yields); everything else returns at once. */
export function main(argv: readonly string[], paths: Paths): number | Promise<number> {
  try {
    const args = parseArguments(argv);
    if (args.golden) {
      const wasm = loadWasm(paths);
      return args.update ? writeGolden(paths.repo, wasm) : checkGolden(paths.repo, wasm);
    }
    const wasm = loadWasm(paths);
    if (args.take !== null) {
      const file = resolve(args.take);
      return runTake({ file, fromArm: args.fromArm, out: args.out ?? takeOutFile(paths.repo, file, args.fromArm) }, { wasm, samplePacks: args.samples ? VOICE_PACKS : [] });
    }
    const now = clockOf(args.clock);
    if (args.clock === "cpu") console.log("clock: CPU time of this thread (other processes do not count)");
    if (args.costs) return measureCosts(paths.repo, wasm, args.rounds, now);
    if (args.levels) return measureLevels(paths.repo, wasm, now);
    if (args.gain) return checkGain(wasm, now);
    if (args.capacity !== null) return checkGovernor(wasm, args.capacity, now);
    if (args.timbre) return runTimbre({ repo: paths.repo, wasm, out: resolve(args.out ?? join(paths.repo, TIMBRE_REPORT)), failClosed: args.failClosed, only: args.only });
    if (args.templates) return writeTemplateRenders(paths.repo, wasm, resolve(args.out ?? join(paths.repo, TEMPLATE_RENDERS)));
    const calibration = calibrateInNode(wasm, now);
    return args.scale ? runScale({ repo: paths.repo, wasm, calibration, now }) : runFile(args, paths, calibration, wasm, now);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`sim: ${error.message}`);
      console.error("usage: pnpm sim <file.untzel> [--bars N | --seconds S] [--tracks N] [--out dir] [--seed S] [--mode loop|song] [--section <name|all>] [--rounds N] [--clock wall|cpu] [--no-samples] | --scale | --costs | --levels | --gain | --capacity <units> | --timbre [--fail-closed] [--only a,b] | --templates [--out dir] | --take <take.json> [--from-arm] [--out file.wav]");
      return 2;
    }
    throw error;
  }
}
