// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { formatDiagnostic, main, parseArguments, verdict, withinDesignTolerance } from "./cli";
import { barAt, dbfs, summarizeAudio, valueText } from "./render/report";
import { failures, runSource } from "./render/run";
import { stressSource } from "./stress";
import { encodeWav } from "@untzel/export/wav";

const wasmPath = fileURLToPath(new URL("../../../packages/dsp/dist/untzel_dsp.wasm", import.meta.url));
const hasWasm = existsSync(wasmPath);
// The CLI prints its summary; keep the test output short.
vi.spyOn(console, "error").mockImplementation(() => undefined);
vi.spyOn(console, "log").mockImplementation(() => undefined);

const eventsOnly = { mode: "loop", seconds: null, bars: 2, tracks: null, seed: null, wasm: null, calibration: null, now: () => 0 } as const;

describe("pnpm sim arguments", () => {
  it("reads every option and rejects --bars with --seconds", () => {
    expect(parseArguments(["a.untzel", "--bars", "4", "--tracks", "8", "--seed", "7", "--mode", "song"])).toMatchObject({
      file: "a.untzel",
      bars: 4,
      tracks: 8,
      seed: 7,
      mode: "song",
    });
    expect(() => parseArguments(["a.untzel", "--bars", "4", "--seconds", "2"])).toThrow(/not both/);
    expect(() => parseArguments([])).toThrow(/missing/);
  });

  it("accepts --timbre without a file and reads --fail-closed", () => {
    expect(parseArguments(["--timbre"])).toMatchObject({ timbre: true, failClosed: false, file: null });
    expect(parseArguments(["--timbre", "--fail-closed"])).toMatchObject({ timbre: true, failClosed: true });
    expect(parseArguments(["--timbre", "--only", "piano,kick"]).only).toEqual(new Set(["piano", "kick"]));
    expect(parseArguments(["--templates"])).toMatchObject({ templates: true, file: null });
    expect(() => parseArguments(["--timbre", "--only"])).toThrow();
  });
});

describe("exit codes", () => {
  const paths = { repo: tmpdir(), wasm: wasmPath };

  it("exits 2 on bad arguments and an unreadable file", () => {
    expect(main(["--bars"], paths)).toBe(2);
    expect(main([join(tmpdir(), "untzel-missing.untzel")], paths)).toBe(2);
  }, 30_000);

  it("a text without a song refuses song mode with its code", () => {
    expect(() => runSource("tempo 132\nkick: kick x...\n", { name: "loop", ...eventsOnly, mode: "song" })).toThrow(expect.objectContaining({ code: "SONG_UNAVAILABLE", mode: "song" }));
  });
  it.skipIf(!hasWasm)("exits 1 with one line, no stack trace, when the text has no song", () => {
    const directory = mkdtempSync(join(tmpdir(), "untzel-sim-"));
    const errors = vi.mocked(console.error);
    errors.mockClear();
    try {
      const file = join(directory, "loop.untzel");
      writeFileSync(file, "tempo 132\nkick: kick x...\n");
      expect(main([file, "--mode", "song", "--bars", "1"], { ...paths, repo: directory })).toBe(1);
      expect(errors.mock.calls).toEqual([[`sim: ${file} has no song (SONG_UNAVAILABLE)`]]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);
  it.skipIf(!hasWasm)("exits 2 on invalid text, after printing the diagnostics", () => {
    const directory = mkdtempSync(join(tmpdir(), "untzel-sim-"));
    try {
      const file = join(directory, "bad.untzel");
      writeFileSync(file, "tempo 132\nkick: kik x...\n");
      expect(main([file], { ...paths, repo: directory })).toBe(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("diagnostics", () => {
  it("prints file, line and column, 1-based", () => {
    const source = "tempo 132\nkick: kik x...\n";
    const result = runSource(source, { name: "bad", ...eventsOnly });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(formatDiagnostic("bad.untzel", source, result.diagnostics[0]!)).toMatch(/^bad\.untzel:2:7: error UNKNOWN_INSTRUMENT /);
  });
});

describe("simulation without the DSP", () => {
  it("schedules the stress text on the beat, from the 128-aligned start", () => {
    const result = runSource(stressSource([{ name: "kick", defaultPattern: "x... x... x... x..." }], 1), { name: "k", ...eventsOnly });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const frames = result.run.events.map((event) => event.frame);
    expect(frames[0]).toBe(5760);
    expect(frames[1]! - frames[0]!).toBe(Math.floor((60 * 48_000) / 132));
    expect(result.events.split("\n")[1]).toBe("1\t1.000\t5760\tkick\tx\t21..22");
  });

  it("duplicates tracks to reach --tracks", () => {
    const result = runSource("kick: kick x...\nhat: hat ..x.\n", { name: "t", ...eventsOnly, tracks: 5 });
    expect(result.ok && result.program.tracks.map((track) => track.name).sort()).toEqual(["hat", "hat2", "kick", "kick2", "kick3"]);
  });
});

describe("measurements", () => {
  it("counts NaN and clipped samples and reads the peak in dBFS", () => {
    const left = new Float32Array([0.5, Number.NaN, 1, -0.25]);
    const summary = summarizeAudio({ left, right: new Float32Array(4) });
    expect(summary).toMatchObject({ nonFinite: 1, clippedSamples: 1, peakDbfs: 0 });
    expect(dbfs(0.5)).toBeCloseTo(-6.0206, 4);
  });

  it("converts frames to bars across tempo changes", () => {
    const tempo = [
      { frame: 0, bpm: 120, bar: 0 },
      { frame: 96_000, bpm: 60, bar: 1 },
    ];
    expect(barAt(48_000, tempo, 48_000)).toBe(0.5);
    expect(barAt(96_000 + 96_000, tempo, 48_000)).toBe(1.5);
    expect(valueText({ kind: "note", midi: 39, writtenMidi: 39 })).toBe("eb2");
  });

  it("fails on NaN, clipping, a peak above 0 dBFS and drift of a sample or more", () => {
    const result = runSource("kick: kick x...\n", { name: "k", ...eventsOnly });
    if (!result.ok) throw new Error("fixture");
    const clean = { peakDbfs: -1, rmsDbfs: -20, nonFinite: 0, clippedSamples: 0 };
    const report = (audio: typeof clean, drift: number | null) => ({
      ...result.report,
      audio,
      kickDrift: { ...result.report.kickDrift, samples: drift },
    });
    expect(failures(report(clean, 0))).toEqual([]);
    expect(failures(report({ ...clean, nonFinite: 3 }, 0))).toEqual(["3 NaN/inf samples"]);
    expect(failures(report({ ...clean, peakDbfs: 0, clippedSamples: 2 }, 0))).toEqual(["2 samples at or above full scale"]);
    expect(failures(report({ ...clean, peakDbfs: 0.5, clippedSamples: 1 }, 0))).toHaveLength(2);
    expect(failures(report(clean, 1))).toEqual(["kick drift 1 samples"]);
    expect(failures(report(clean, null))).toEqual([]);
  });

  it("exits 1 on NaN, clipping or drift and 0 on a clean run", () => {
    const result = runSource("kick: kick x...\n", { name: "k", ...eventsOnly });
    if (!result.ok) throw new Error("fixture");
    const clean = { peakDbfs: -1, rmsDbfs: -20, nonFinite: 0, clippedSamples: 0 };
    const report = (audio: typeof clean, drift: number | null) => ({
      ...result.report,
      audio,
      kickDrift: { ...result.report.kickDrift, samples: drift },
    });
    expect(verdict(report(clean, 0))).toBe(0);
    expect(verdict(report({ ...clean, nonFinite: 1 }, 0))).toBe(1);
    expect(verdict(report({ ...clean, peakDbfs: 0, clippedSamples: 1 }, 0))).toBe(1);
    expect(verdict(report(clean, 1))).toBe(1);
  });

  it("applies the design tolerance of the scale test", () => {
    expect(withinDesignTolerance(0.002, 0.0016)).toBe(true);
    expect(withinDesignTolerance(0.5, 0.6)).toBe(false);
    expect(withinDesignTolerance(0.5, 0.56)).toBe(true);
  });

  it("writes a 24-bit stereo WAV header", () => {
    const bytes = encodeWav(new Float32Array([1, -1]), new Float32Array(2), 48_000);
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint16(34, true)).toBe(24);
    expect(view.getUint32(40, true)).toBe(2 * 2 * 3);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
    expect([bytes[44], bytes[45], bytes[46]]).toEqual([0xff, 0xff, 0x7f]);
  });
});
