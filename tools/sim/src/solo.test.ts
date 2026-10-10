// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Solo and mute through the real Session, Transport and DSP: a track whose gain is a
// signal or a fast LFO goes silent like any other.
import { existsSync, readFileSync } from "node:fs";
import type { Program } from "@untzel/core";
import { analyze } from "@untzel/language";
import { Session } from "@untzel/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeScheduleFeed, FakeSoundPort } from "@untzel/session/testing";
import { describe, expect, it } from "vitest";
import { simRegistry } from "./registry";
import { simulate, type SimulationRun } from "./render/simulate";

const wasmPath = new URL("../../../packages/dsp/dist/untzel_dsp.wasm", import.meta.url);
const hasWasm = existsSync(wasmPath);
const SAMPLE_RATE = 48_000;
const TEMPO = 120;
const BAR_SECONDS = 240 / TEMPO;
/** The solo lands 128 frames after it is asked for, then fades in 20 ms. */
const SETTLE_SECONDS = 0.025;
const SOLO_AT_SECONDS = 1.3;
const MEASURED_BARS = 4;
const SILENT_DBFS = -90;

const GAINS = ["sine(4) 0.2..0.8", "sine(1/4) 0.2..0.8", "0.5"];

function textWith(gain: string, muted = false): string {
  const mute = muted ? " | mute" : "";
  return `tempo ${TEMPO}\nkick: kick ....\npad: pad warm c3 ~ ~ ~ | gain ${gain}${mute}\n`;
}

function programOf(source: string): Program {
  const result = analyze(source, simRegistry().registry);
  if (!result.ok) throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
  return result.program;
}

/** What the session hands the sound while `track` is held in solo. */
function soloedBySession(source: string, track: string): Program {
  const sound = new FakeSoundPort();
  const session = new Session({
    sound,
    load: new FakeLoadPort(),
    log: new FakeDiagnosticsLog(),
    schedule: new FakeScheduleFeed(),
    analyze: (text) => analyze(text, simRegistry().registry),
  });
  session.applyText(source);
  expect(session.solo(track)).toEqual({ ok: true });
  const soloed = sound.loads().at(-1);
  if (soloed === undefined) throw new Error("the session loaded nothing");
  return soloed;
}

function render(program: Program, programChange?: { atFrame: number; program: Program }): SimulationRun {
  const instruments = simRegistry().instruments.map((manifest) => manifest.name);
  const seconds = SOLO_AT_SECONDS + SETTLE_SECONDS + MEASURED_BARS * BAR_SECONDS + 0.1;
  const wasm = new WebAssembly.Module(readFileSync(wasmPath));
  return simulate({ program, instruments, mode: "loop", sampleRate: SAMPLE_RATE, seconds, wasm, now: () => 0, ...(programChange === undefined ? {} : { programChange }) });
}

/** RMS of both channels over [from, to), by default 4 bars, in dBFS. */
function rmsDbfs(run: SimulationRun, from: number, to = from + Math.round(MEASURED_BARS * BAR_SECONDS * SAMPLE_RATE)): number {
  const { audio } = run;
  if (audio === null) throw new Error("rendered without the DSP");
  let sum = 0;
  for (let index = from; index < to; index += 1) {
    sum += (audio.left[index] ?? 0) ** 2 + (audio.right[index] ?? 0) ** 2;
  }
  return 10 * Math.log10(sum / (2 * (to - from)) + 1e-30);
}

describe("solo silences the other tracks whatever drives their gain", () => {
  for (const gain of GAINS) {
    it.skipIf(!hasWasm)(`pad gain ${gain}: silent from 25 ms after the solo, for 4 bars`, () => {
      const source = textWith(gain);
      const playing = programOf(source);
      const atFrame = Math.round(SOLO_AT_SECONDS * SAMPLE_RATE);
      const run = render(playing, { atFrame, program: soloedBySession(source, "kick") });
      expect(rmsDbfs(run, run.startFrame ?? 0, atFrame)).toBeGreaterThan(-40);
      expect(rmsDbfs(run, atFrame + Math.round(SETTLE_SECONDS * SAMPLE_RATE))).toBeLessThan(SILENT_DBFS);
    });
  }
});

describe("mute silences a track whatever drives its gain", () => {
  for (const gain of GAINS) {
    it.skipIf(!hasWasm)(`pad gain ${gain} | mute: silent for 4 bars`, () => {
      const run = render(programOf(textWith(gain, true)));
      expect(rmsDbfs(run, run.startFrame ?? 0)).toBeLessThan(SILENT_DBFS);
    });
  }
});
