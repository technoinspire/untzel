// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The take-render measurement: a long take recorded by the live rig and
// its sound rendered by the export's own ExportAudio over the DSP, timed from the take's
// text to the last sample (decode, materialize, replay and DSP). The edits turn one knob
// back and forth over seven values, as a person does, so the materialize memory has
// something to keep; the cost without it is the measured mean materialize time paid by
// every sounding entry, the work the memory skips.
import { renderAudio } from "@untzel/export/render-audio";
import { decodeTake, encodeTake } from "@untzel/take";
import type { Materialize } from "@untzel/take/replay";
import { LiveRig, RIG_SAMPLE_RATE } from "./take-rig";
import { simTakeParts, takeAudio, takePlan } from "./take-render";

const LOOP = "tempo 128\nkick x... x... x... x... | drive 0.3\nhat ..x. ..x. ..x. ..x.\nbass a1 . . a1 . . c2 . | cutoff 600";

export interface TakeRenderMeasurement {
  readonly takeSeconds: number;
  readonly edits: number;
  readonly entries: number;
  readonly soundings: number;
  readonly frames: number;
  readonly musicFrames: number;
  readonly takeChars: number;
  readonly withMemory: { readonly elapsedMs: number; readonly share: number; readonly materializeCalls: number; readonly materializeMs: number };
  readonly withoutMemory: { readonly estimatedMs: number; readonly share: number; readonly meanMaterializeMs: number };
  readonly counters: { readonly lateDrops: number; readonly queueDrops: number; readonly nanResets: number };
}

function recordedTake(seconds: number, edits: number): string {
  const rig = new LiveRig();
  rig.load(LOOP);
  rig.runTo(1_100);
  rig.send({ kind: "play", mode: "loop", startBar: null });
  const firstSoundMs = ((rig.recorder.firstSoundFrame() ?? 0) * 1_000) / RIG_SAMPLE_RATE;
  for (let edit = 0; edit < edits; edit += 1) {
    rig.runTo(firstSoundMs + ((edit + 1) * seconds * 1_000) / (edits + 1));
    rig.load(LOOP.replace("cutoff 600", `cutoff ${400 + (edit % 7) * 100}`));
  }
  rig.runTo(firstSoundMs + seconds * 1_000);
  rig.send({ kind: "stop" });
  return encodeTake(rig.finish(null));
}

export function measureTakeRender(wasm: WebAssembly.Module, seconds: number, edits: number): TakeRenderMeasurement {
  const encoded = recordedTake(seconds, edits);
  const started = performance.now();
  const decoded = decodeTake(encoded);
  if (!decoded.ok) throw new Error(`the rig's take is refused: ${decoded.reason}`);
  const take = decoded.take;
  const parts = simTakeParts("firstSound");
  const timing = { calls: 0, ms: 0 };
  const materialize: Materialize = (recipe) => {
    const at = performance.now();
    const program = parts.materialize(recipe);
    timing.calls += 1;
    timing.ms += performance.now() - at;
    return program;
  };
  const plan = takePlan(take, "firstSound", "audio");
  const audio = takeAudio(take, plan, { ...parts, materialize }, { wasm, samplePacks: [] });
  let frames = 0;
  for (const block of renderAudio(audio, plan.musicFrames, 0, plan.sampleRate)) frames += block.left.length;
  const elapsedMs = performance.now() - started;
  const soundings = take.entries.filter((entry) => entry.command.kind === "sounding").length;
  const meanMaterializeMs = timing.ms / Math.max(1, timing.calls);
  const estimatedMs = elapsedMs - timing.ms + soundings * meanMaterializeMs;
  const realMs = plan.musicSeconds * 1_000;
  return {
    takeSeconds: plan.musicSeconds,
    edits,
    entries: take.entries.length,
    soundings,
    frames,
    musicFrames: plan.musicFrames,
    takeChars: encoded.length,
    withMemory: { elapsedMs, share: elapsedMs / realMs, materializeCalls: timing.calls, materializeMs: timing.ms },
    withoutMemory: { estimatedMs, share: estimatedMs / realMs, meanMaterializeMs },
    counters: audio.counters(),
  };
}
