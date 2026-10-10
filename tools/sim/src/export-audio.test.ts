// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's sound against the simulator's: the same Transport, DspHost and WASM, so
// the same samples. Lives here because packages may not import tools/.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fnv1a32 } from "@untzel/core";
import { planExport, type ExportPlan, type PlannedSource } from "@untzel/export";
import { ExportAudio, programTimeline } from "@untzel/export/render-audio";
import { analyze } from "@untzel/language";
import type { ScheduledBatch } from "@untzel/session";
import { Transport } from "@untzel/transport";
import { describe, expect, it } from "vitest";
import { simRegistry } from "./registry";
import { simulate } from "./render/simulate";
import { firstTouchTemplate, readTemplateTree } from "./templates/template-tree";

const wasmPath = fileURLToPath(new URL("../../../packages/dsp/dist/untzel_dsp.wasm", import.meta.url));
/** The 132 BPM onboard fixture, whose bar 9 downbeat the play range test is about. */
const phase1OnboardPath = fileURLToPath(new URL("../fixtures/phase1-onboard.untzel", import.meta.url));
const firstTouch = firstTouchTemplate(readTemplateTree(fileURLToPath(new URL("../../../", import.meta.url))));
const hasWasm = existsSync(wasmPath);
/** The program's part of a plan: its pre-roll and fade-in. */
function programSource(plan: ExportPlan): Extract<PlannedSource, { kind: "program" }> {
  if (plan.source.kind !== "program") throw new Error("a program's plan has a program source");
  return plan.source;
}

describe("export audio", () => {
  it.skipIf(!hasWasm)("renders 16 bars of the first-touch template exactly as the simulator, nothing after the end", () => {
    const { registry, instruments } = simRegistry();
    const names = instruments.map((manifest) => manifest.name);
    const analyzed = analyze(firstTouch.text, registry);
    if (!analyzed.ok) throw new Error(`${firstTouch.id} does not analyze`);
    const wasm = new WebAssembly.Module(readFileSync(wasmPath));
    const planned = planExport(analyzed.program, { format: "audio", quality: "hd", range: { kind: "bars", bars: 16 }, mode: "loop", position: null }, false);
    if (!planned.ok) throw new Error(planned.reason);
    const { plan } = planned;

    const batches: ScheduledBatch[] = [];
    const audio = new ExportAudio({
      plan,
      module: wasm,
      instruments: names,
      instrumentHashes: names.map((name) => fnv1a32(name)),
      timeline: programTimeline(plan, analyzed.program, (clock, sink) => new Transport({ clock, sink })),
      onBatch: (batch) => batches.push(batch),
    });
    const exported = audio.read(plan.musicFrames);
    const reference = simulate({
      program: analyzed.program,
      instruments: names,
      mode: "loop",
      sampleRate: 48_000,
      seconds: plan.musicSeconds + 0.5,
      wasm,
      now: () => 0,
    });
    const start = reference.startFrame ?? -1;
    expect(audio.startFrame).toBe(start);
    const left = reference.audio?.left.subarray(start, start + plan.musicFrames);
    const right = reference.audio?.right.subarray(start, start + plan.musicFrames);
    let rms = 0;
    for (let index = 0; index < plan.musicFrames; index += 1) {
      if (exported.left[index] !== left?.[index] || exported.right[index] !== right?.[index]) {
        throw new Error(`sample ${index} differs`);
      }
      rms += (exported.left[index] ?? 0) ** 2;
    }
    expect(Math.sqrt(rms / plan.musicFrames)).toBeGreaterThan(0.01);
    const end = start + plan.musicFrames;
    expect(batches.flatMap((batch) => batch.events).every((event) => event.frame < end)).toBe(true);
    expect(batches.flatMap((batch) => batch.parameters).every((point) => point.frame < end)).toBe(true);
    expect(reference.events.some((event) => event.frame >= end)).toBe(true);
    audio.read(48_000); // the tails after the end
    expect(audio.counters()).toEqual({ lateDrops: 0, queueDrops: 0, nanResets: 0 });
  }, 60_000); // two renders of 16 bars; slow when the whole suite runs in parallel

  it.skipIf(!hasWasm)("starts a play range on its first bar to the sample, after a pre-roll bar that sounds and is dropped", () => {
    const { registry, instruments } = simRegistry();
    const names = instruments.map((manifest) => manifest.name);
    const analyzed = analyze(readFileSync(phase1OnboardPath, "utf8"), registry);
    if (!analyzed.ok) throw new Error("the phase 1 onboard does not analyze");
    const planned = planExport(analyzed.program, { format: "audio", quality: "hd", range: { kind: "span", startTick: 512, endTick: 768 }, mode: "loop", position: null }, false);
    if (!planned.ok) throw new Error(planned.reason);
    const { plan } = planned;
    const batches: ScheduledBatch[] = [];
    let activatedAt: number | null = null;
    const audio = new ExportAudio({
      plan,
      module: new WebAssembly.Module(readFileSync(wasmPath)),
      instruments: names,
      instrumentHashes: names.map((name) => fnv1a32(name)),
      timeline: programTimeline(plan, analyzed.program, (clock, sink) => new Transport({ clock, sink })),
      onActivation: (activation) => (activatedAt ??= activation.atFrame),
      onBatch: (batch) => batches.push(batch),
    });
    const exported = audio.read(plan.musicFrames);
    // The play began on bar 8 (1-based), one bar before export sample 0.
    expect(audio.startFrame - (activatedAt ?? 0)).toBe(programSource(plan).preRollFrames);
    const events = batches.flatMap((batch) => batch.events);
    expect(events.some((event) => event.frame < audio.startFrame), "the pre-roll bar sounds").toBe(true);
    expect(events.some((event) => event.frame === audio.startFrame), "bar 9's downbeat is export sample 0").toBe(true);
    expect(events.every((event) => event.frame < audio.startFrame + plan.musicFrames)).toBe(true);
    expect(exported.left.length).toBe(plan.musicFrames);
    expect(audio.counters()).toEqual({ lateDrops: 0, queueDrops: 0, nanResets: 0 });
  }, 60_000);

  it.skipIf(!hasWasm)("starts a stretch on a step at that very sample, with a 10 ms fade-in and nothing else changed", () => {
    const { registry, instruments } = simRegistry();
    const names = instruments.map((manifest) => manifest.name);
    const analyzed = analyze(readFileSync(phase1OnboardPath, "utf8"), registry);
    if (!analyzed.ok) throw new Error("the phase 1 onboard does not analyze");
    const wasm = new WebAssembly.Module(readFileSync(wasmPath));
    const render = (startTick: number, endTick: number) => {
      const planned = planExport(analyzed.program, { format: "audio", quality: "hd", range: { kind: "span", startTick, endTick }, mode: "loop", position: null }, false);
      if (!planned.ok) throw new Error(planned.reason);
      const audio = new ExportAudio({
        plan: planned.plan,
        module: wasm,
        instruments: names,
        instrumentHashes: names.map((name) => fnv1a32(name)),
        timeline: programTimeline(planned.plan, analyzed.program, (clock, sink) => new Transport({ clock, sink })),
      });
      return { plan: planned.plan, audio, block: audio.read(planned.plan.musicFrames) };
    };
    // Bar 9 on the beat, and bar 9 beat 3 step 3 (40 ticks in): the same play, from bar 8.
    const onBar = render(512, 768);
    const onStep = render(552, 768);
    const offset = programSource(onStep.plan).preRollFrames - programSource(onBar.plan).preRollFrames;
    expect(offset).toBe(Math.floor((552 / 64) * ((240 * 48_000) / 132)) - Math.floor((512 / 64) * ((240 * 48_000) / 132)));
    expect(onStep.audio.startFrame - onBar.audio.startFrame).toBe(offset);
    expect(programSource(onStep.plan).fadeInFrames).toBe(480);
    for (let index = 0; index < onStep.plan.musicFrames; index += 1) {
      const gain = index < 480 ? index / 480 : 1;
      const expected = Math.fround((onBar.block.left[offset + index] ?? 0) * gain);
      if (onStep.block.left[index] !== expected) throw new Error(`sample ${index} differs: ${onStep.block.left[index]} against ${expected}`);
    }
    expect(Math.abs(onStep.block.left[0] ?? 1)).toBe(0);
    expect(onStep.audio.counters()).toEqual({ lateDrops: 0, queueDrops: 0, nanResets: 0 });
  }, 60_000);
});
