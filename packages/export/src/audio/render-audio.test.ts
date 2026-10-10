// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The timeline seam against the export's loop of before: a program still
// sounds the same, sample by sample, on the real DSP; a take's timeline goes on past the
// song's end.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DspHost, QUANTUM } from "@untzel/audio/dsp-host";
import { PROTOCOL_VERSION, packBatch, toWorkletProgram } from "@untzel/audio/protocol";
import { fnv1a32, type Program } from "@untzel/core";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "@untzel/language";
import type { ClockPort, EventSink } from "@untzel/session";
import { Transport } from "@untzel/transport";
import { describe, expect, it } from "vitest";
import { planExport, type ExportPlan, type ExportRange } from "../plan";
import { ExportAudio, programTimeline, type ExportTimeline, type TimelineContext } from "./render-audio";
import { planTake } from "../take-plan";

const wasmPath = fileURLToPath(new URL("../../../dsp/dist/untzel_dsp.wasm", import.meta.url));
const hasWasm = existsSync(wasmPath);
// The DSP's instruments in registry order (createRegistry sorts by name): every directory of instruments/.
const instrumentsDir = fileURLToPath(new URL("../../../../instruments/", import.meta.url));
const NAMES = readdirSync(instrumentsDir)
  .filter((name) => existsSync(`${instrumentsDir}${name}/manifest.json`))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const HASHES = NAMES.map((name) => fnv1a32(name));
const TEXT = "tempo 132\nkick x... x... x... x...\nhat ..x. ..x. ..x. ..xx\nbass a1 . a1 . c2 . a1 . | gain 0.8";
/** 25 ms at 48 kHz: the worker's tick. */
const TICK_FRAMES = 1_200;

function program(): Program {
  const analyzed = analyze(TEXT, registryWith(["kick", "hat", "bass"]));
  if (!analyzed.ok) throw new Error("the text does not analyze");
  return analyzed.program;
}

function plan(of: Program, range: ExportRange): ExportPlan {
  const planned = planExport(of, { format: "audio", quality: "hd", range, mode: "loop", position: null }, false);
  if (!planned.ok) throw new Error(planned.reason);
  return planned.plan;
}

/**
 * The export's loop before the timeline seam, kept as the reference: the Transport on the
 * render clock, a tick every 25 ms until the music's end, every quantum rendered from frame
 * 0, sample 0 at the first activation plus the pre-roll, the 10 ms fade-in of a cut.
 */
function referenceRender(module: WebAssembly.Module, of: Program, exported: ExportPlan): Float32Array {
  const { source } = exported;
  if (source.kind !== "program") throw new Error("a program plan");
  const host = new DspHost({ module, protocol: PROTOCOL_VERSION, instrumentHashes: HASHES }, 48_000);
  const clock: ClockPort & { frame: number } = { sampleRate: 48_000, frame: 0, nowFrame: () => clock.frame, staleness: () => 0 };
  let startFrame: number | null = null;
  let endFrame = Number.POSITIVE_INFINITY;
  let hasEnded = false;
  const sink: EventSink = {
    deliver: (batch) => {
      const kept = { events: batch.events.filter((event) => event.frame < endFrame), parameters: batch.parameters.filter((point) => point.frame < endFrame), position: batch.position };
      host.receive({ type: "batch", data: packBatch(kept) }, clock.frame);
    },
    programChanged: (change) => {
      if (startFrame === null) {
        startFrame = change.atFrame + source.preRollFrames;
        endFrame = startFrame + exported.musicFrames;
      }
      host.receive(toWorkletProgram(change, NAMES), clock.frame);
    },
    tempoChanged: (change) => void host.receive({ type: "tempo", bpm: change.bpm, atFrame: change.atFrame }, clock.frame),
    stopped: (atFrame) => void host.receive({ type: "stop", atFrame }, clock.frame),
    ended: () => void (hasEnded = true),
  };
  const transport = new Transport({ clock, sink });
  transport.setProgram(of);
  transport.play(source.mode, { startBar: source.startBar - source.preRollBars });
  const rendered: number[] = [];
  let nextTick = 0;
  for (let frame = 0; startFrame === null || frame < startFrame + exported.musicFrames; frame += QUANTUM) {
    clock.frame = frame;
    const pastEnd = startFrame !== null && frame >= endFrame;
    if (frame >= nextTick && !pastEnd && !hasEnded) {
      transport.tick();
      nextTick += TICK_FRAMES;
    }
    host.render(frame);
    rendered.push(...host.left);
  }
  const from = startFrame ?? 0;
  return Float32Array.from(rendered.slice(from, from + exported.musicFrames), (sample, index) =>
    index < source.fadeInFrames ? Math.fround(sample * (index / source.fadeInFrames)) : sample,
  );
}

describe("programTimeline", () => {
  const module = hasWasm ? new WebAssembly.Module(readFileSync(wasmPath)) : null;
  const ranges: readonly (readonly [string, ExportRange])[] = [
    ["eight bars from the start", { kind: "bars", bars: 8 }],
    ["a stretch from a step, after a pre-roll bar, with its fade-in", { kind: "span", startTick: 72, endTick: 328 }],
  ];
  it.skipIf(module === null).each(ranges)("sounds as the loop before the seam: %s", (_, range) => {
    if (module === null) return;
    const of = program();
    const exported = plan(of, range);
    const audio = new ExportAudio({
      plan: exported,
      module,
      instruments: NAMES,
      instrumentHashes: HASHES,
      timeline: programTimeline(exported, of, (clock, sink) => new Transport({ clock, sink })),
    });
    const left = audio.read(exported.musicFrames).left;
    const reference = referenceRender(module, of, exported);
    expect(left.length).toBe(reference.length);
    for (let index = 0; index < reference.length; index += 1) {
      if (left[index] !== reference[index]) throw new Error(`sample ${index} differs: ${left[index]} against ${reference[index]}`);
    }
    expect(reference.some((sample) => Math.abs(sample) > 0.01)).toBe(true);
  }, 60_000);
});

describe("ExportAudio with a timeline", () => {
  const module = hasWasm ? new WebAssembly.Module(readFileSync(wasmPath)) : null;
  /** Says the song ended at frame 512; records every frame it is advanced to. */
  function fakeTimeline(endsWithSong: boolean): ExportTimeline & { readonly frames: number[] } {
    const frames: number[] = [];
    let context: TimelineContext | null = null;
    return {
      frames,
      start(given) {
        context = given;
        return { firstFrame: 256, musicStartFrame: 1_000, endsWithSong };
      },
      advance(frame) {
        frames.push(frame);
        if (frame === 512) context?.sink.ended(frame);
      },
    };
  }
  function render(endsWithSong: boolean) {
    const planned = planTake(1, { format: "audio", quality: "hd" }, false);
    if (!planned.ok || module === null) throw new Error("no plan or no DSP");
    const timeline = fakeTimeline(endsWithSong);
    const audio = new ExportAudio({ plan: planned.plan, module, instruments: NAMES, instrumentHashes: HASHES, timeline });
    audio.read(planned.plan.musicFrames);
    return { audio, frames: timeline.frames };
  }
  it.skipIf(module === null)("starts at the timeline's first frame, sample 0 where it says, and advances past the song's end for a take", () => {
    const { audio, frames } = render(false);
    expect(audio.startFrame).toBe(1_000);
    expect(frames[0]).toBe(256);
    expect(frames.every((frame, index) => index === 0 || frame - (frames[index - 1] ?? 0) === QUANTUM)).toBe(true);
    // Every quantum up to the end of the music (1 000 + 48 000), none after.
    expect(frames.at(-1)).toBe(Math.ceil((1_000 + 48_000) / QUANTUM) * QUANTUM - QUANTUM);
  });
  it.skipIf(module === null)("stops advancing at the song's end when the timeline ends with it, as a program does", () => {
    expect(render(true).frames.at(-1)).toBe(512);
  });
});
