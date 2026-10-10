// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm sim --take: a take rendered by the export's own ExportAudio and writers,
// with the simulator's analysis and registry and the DSP's audition slot. Without
// --from-arm it writes the WAV the Export sheet writes (sample 0 at the first sound); with
// it, the sound track of a video from the arm (the demo): the music and the 2 s of the
// closing card, faded over its last 500 ms as in an MP4 export.
import type { SamplePackData } from "@untzel/audio/protocol";
import { fnv1a32, type Program } from "@untzel/core";
import { SAMPLES_PER_VIDEO_FRAME, type ExportFormat, type ExportPlan } from "@untzel/export/plan";
import { planTake } from "@untzel/export/take-plan";
import { ExportAudio, VIDEO_FADE_FRAMES, renderAudio } from "@untzel/export/render-audio";
import { renderWav } from "@untzel/export/render-wav";
import { WAV_BYTES_PER_FRAME, WAV_INFO, encodePcm24, infoChunk, wavHeader } from "@untzel/export/wav";
import { analyze } from "@untzel/language";
import { soundingProgram } from "@untzel/session/sounding";
import { takeSpan, type Take, type TakeOrigin } from "@untzel/take";
import { TakeReplayError, takeTimeline, type Materialize, type TakeTimelineParts } from "@untzel/take/replay";
import { BACKGROUND_LOOKAHEAD_SECONDS, PreviewTransport, Transport } from "@untzel/transport";
import { createSimPreviewSink } from "./preview-sink";
import { simRegistry } from "../registry";

export interface TakeRenderOptions {
  readonly wasm: WebAssembly.Module;
  /** The decoded sample packs (VOICE_PACKS); the DSP ignores those of instruments the take never played. */
  readonly samplePacks: readonly SamplePackData[];
}

/** A finished file: the bytes and the samples per channel in it. */
export interface TakeWav {
  readonly bytes: Uint8Array;
  readonly frames: number;
}

/** Text → Program as the page analyzes it, with the simulator's registry. */
function simMaterialize(): Materialize {
  const { registry } = simRegistry();
  const programOf = (text: string): Program => {
    const analyzed = analyze(text, registry);
    if (!analyzed.ok) throw new TakeReplayError("UNPLAYABLE_TEXT");
    return analyzed.program;
  };
  return (recipe) =>
    soundingProgram({
      program: programOf(recipe.source),
      solo: recipe.solo,
      preview: recipe.preview === null ? null : { track: recipe.preview.track, program: programOf(recipe.preview.text) },
    });
}

/** The replay's parts in the simulator: the audition too, which the export worker has not. */
export function simTakeParts(origin: TakeOrigin): TakeTimelineParts {
  return {
    materialize: simMaterialize(),
    createTransport: (clock, sink) => new Transport({ clock, sink }),
    createPreview: (clock, sink) => new PreviewTransport({ clock, sink }),
    origin,
    maxLookaheadSeconds: BACKGROUND_LOOKAHEAD_SECONDS,
  };
}

/** The plan of a take from `origin`, in `format` at HD; a decoded take always has a stretch. */
export function takePlan(take: Take, origin: TakeOrigin, format: ExportFormat): ExportPlan {
  const span = takeSpan(take, origin);
  const planned = planTake(span?.seconds ?? 0, { format, quality: "hd" }, false);
  if (!planned.ok) throw new Error(`sim: the take has no stretch to render from ${origin} (${planned.reason})`);
  return planned.plan;
}

/** The export's renderer over the take, with the DSP's audition slot. */
export function takeAudio(take: Take, plan: ExportPlan, parts: TakeTimelineParts, options: TakeRenderOptions): ExportAudio {
  const names = simRegistry().instruments.map((manifest) => manifest.name);
  return new ExportAudio({
    plan,
    module: options.wasm,
    instruments: names,
    instrumentHashes: names.map((name) => fnv1a32(name)),
    samplePacks: options.samplePacks,
    timeline: takeTimeline(take, parts),
    createPreviewSink: (host, clock) => createSimPreviewSink(host, clock, names),
  });
}

/** The WAV of the Export sheet: from the first sound, the music and its tail, titled as the take. */
export async function renderTakeWav(take: Take, options: TakeRenderOptions): Promise<TakeWav> {
  const plan = takePlan(take, "firstSound", "audio");
  const audio = takeAudio(take, plan, simTakeParts("firstSound"), options);
  const result = await renderWav({ plan, audio, songTitle: take.title, onProgress: () => undefined, isCancelled: () => false });
  if (result.kind !== "done") throw new Error("sim: the take's render was cancelled");
  return { bytes: new Uint8Array(await result.blob.arrayBuffer()), frames: result.frames };
}

/** A video's sound track from the arm: totalVideoFrames × 1 600 samples, 24-bit PCM. */
export function renderTakeVideoTrack(take: Take, options: TakeRenderOptions): TakeWav {
  const plan = takePlan(take, "arm", "video");
  const audio = takeAudio(take, plan, simTakeParts("arm"), options);
  const frames = plan.totalVideoFrames * SAMPLES_PER_VIDEO_FRAME;
  const parts: Uint8Array[] = [];
  for (const block of renderAudio(audio, frames, VIDEO_FADE_FRAMES, plan.sampleRate)) parts.push(encodePcm24(block.left, block.right));
  const info = infoChunk(WAV_INFO, take.title);
  const header = wavHeader(frames, plan.sampleRate, info.length);
  const bytes = new Uint8Array(header.length + frames * WAV_BYTES_PER_FRAME + info.length);
  let offset = 0;
  for (const part of [header, ...parts, info]) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return { bytes, frames };
}
