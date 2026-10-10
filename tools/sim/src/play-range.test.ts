// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range in the real language, transport and DSP: only the range's
// bars play, and neither the wrap nor a range handed in while playing clicks or gaps.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { parseArguments } from "./cli";
import { checkBoundaries } from "./measure/range-check";
import { runSource } from "./render/run";

const wasmPath = fileURLToPath(new URL("../../../packages/dsp/dist/untzel_dsp.wasm", import.meta.url));
const hasWasm = existsSync(wasmPath);
vi.spyOn(console, "log").mockImplementation(() => undefined);

/** Eight bars of a marker: bar k of the pattern hits step k, so each bar is told by when it hits. */
const MARKER = `tempo 132
loop 8
kick:  kick  x... x... x... x...
mark:  hat   x... .... .... .... / .x.. .... .... .... / ..x. .... .... .... / ...x .... .... .... / .... x... .... .... / .... .x.. .... .... / .... ..x. .... .... / .... ...x .... ....
`;
const BAR = (240 * 48_000) / 132;
const STEP = BAR / 16;
const base = { name: "range", mode: "loop", seconds: null, tracks: null, seed: null, calibration: null, now: () => 0, samples: false } as const;

/** The pattern bar heard in each bar after the start, from the marker's step. */
function heardBars(events: readonly { readonly frame: number; readonly track: string }[], start: number, bars: number): number[] {
  return Array.from({ length: bars }, (_, bar) => {
    const hit = events.find((event) => event.track === "mark" && event.frame >= start + bar * BAR - 2 && event.frame < start + (bar + 1) * BAR - 2);
    return hit === undefined ? -1 : Math.round((hit.frame - start - bar * BAR) / STEP) + 1;
  });
}

describe("pnpm sim --range", () => {
  it("reads --range, --range-at and --cycle", () => {
    expect(parseArguments(["a.untzel", "--range", "3-6", "--range-at", "4", "--cycle", "off"])).toMatchObject({ range: { startBar: 3, endBar: 6, cycle: false }, rangeAt: 4 });
    expect(() => parseArguments(["a.untzel", "--range", "6-3"])).toThrow(/A-B/);
  });

  it("bars 3–6 of 8 play only bars 3 to 6, in a cycle", () => {
    const result = runSource(MARKER, { ...base, bars: 10, wasm: null, range: { startBar: 3, endBar: 6, cycle: true } });
    if (!result.ok) throw new Error("diagnostics");
    expect(heardBars(result.run.events, result.run.startFrame ?? 0, 10)).toEqual([3, 4, 5, 6, 3, 4, 5, 6, 3, 4]);
  });

  it.skipIf(!hasWasm)("the wrap and a range handed in mid-bar neither click nor gap", () => {
    const wasm = new WebAssembly.Module(readFileSync(wasmPath));
    const onboard = readFileSync(fileURLToPath(new URL("../fixtures/phase1-onboard.untzel", import.meta.url)), "utf8").replace("tempo 132", "tempo 132\nloop 8");
    const plain = runSource(onboard, { ...base, bars: 12, wasm });
    // Handed in 1.5 bars after the start: the music jumps to bar 6 on a later bar line.
    const ranged = runSource(onboard, { ...base, bars: 12, wasm, range: { startBar: 6, endBar: 7, cycle: true }, rangeAtSeconds: (1.5 * 240) / 132 + 0.12 });
    if (!plain.ok || !ranged.ok || plain.run.audio === null || ranged.run.audio === null) throw new Error("no render");
    const without = checkBoundaries(plain.run.audio, plain.run.startFrame ?? 0, 48_000, 132, 12);
    const withRange = checkBoundaries(ranged.run.audio, ranged.run.startFrame ?? 0, 48_000, 132, 12);
    // No bar line jumps more than a beat in the middle of a bar does, with or without the range.
    expect(withRange.maxBoundaryStep).toBeLessThanOrEqual(Math.max(withRange.maxMidStep, without.maxBoundaryStep) * 1.05);
    // Never a gap: the quietest 50 ms keeps sound (the kick's tail and the bass).
    expect(withRange.quietestWindowDbfs).toBeGreaterThan(-60);
    expect(ranged.report.audio?.nonFinite).toBe(0);
    expect(ranged.report.audio?.clippedSamples).toBe(0);
  }, 120_000);
});
