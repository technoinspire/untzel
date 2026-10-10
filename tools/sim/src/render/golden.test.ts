// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The schedule of every template must match tools/sim/golden/ (no WASM needed). The
// sound summary is compared too when packages/dsp/dist/ has a WASM; the CI build job
// runs `pnpm sim:golden`, which always compares both.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { goldenOf, modesOf, readGolden, templates, type GoldenTemplate } from "./golden";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const wasmPath = `${repo}packages/dsp/dist/untzel_dsp.wasm`;
const hasWasm = existsSync(wasmPath);
/** A song render with its solo renders takes seconds, more under a parallel run. */
const RENDER_TIMEOUT_MS = 60_000;

describe.each(templates(repo))("golden files of $name", ({ name, source }) => {
  const modes = modesOf(source);
  const stored = readGolden(repo, name, modes.includes("song"));

  it("schedules exactly the stored events in every mode the template has", () => {
    const golden = goldenOf(name, source, null);
    expect(golden.events.loop).toBe(stored.loop);
    expect(golden.events.song).toBe(stored.song);
    const summary = JSON.parse(stored.summary) as GoldenTemplate["summary"];
    for (const mode of modes) {
      expect(golden.summary.runs[mode]?.eventsPerTrack).toEqual(summary.runs[mode]?.eventsPerTrack);
      expect(golden.summary.runs[mode]?.songEnded).toBe(summary.runs[mode]?.songEnded);
    }
  }, RENDER_TIMEOUT_MS);

  // The loop run only: the song of the melodic onboard is 200 bars of 19 tracks, too long
  // for pnpm test. pnpm sim:golden, in check:full
  // and in CI, compares the whole summary, song included.
  it.skipIf(!hasWasm)("the loop sounds as the stored summary says (needs pnpm build:wasm)", () => {
    const golden = goldenOf(name, source, new WebAssembly.Module(readFileSync(wasmPath)), ["loop"]);
    const summary = JSON.parse(stored.summary) as GoldenTemplate["summary"];
    expect(golden.summary.runs.loop).toEqual(summary.runs.loop);
  }, RENDER_TIMEOUT_MS);
});
