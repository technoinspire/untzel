// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Audio export: PCM 24-bit 48 kHz, the music plus its tail until silence or 4 s. Each
// second becomes PCM at once; only the last second and the tail stay in float until the
// cut is known, then the header is built and the Blob joins the pieces without a copy.
import type { ExportPlan } from "../plan";
import { applyFade, yieldToEvents, type AudioBlock, type ExportAudio } from "./render-audio";
import { WAV_INFO, WAV_MIME, encodePcm24, infoChunk, wavHeader } from "./wav";

/** −80 dBFS. */
export const SILENCE_LEVEL = 1e-4;
export const SILENCE_SECONDS = 0.25;
export const WAV_FADE_SECONDS = 0.05;

export interface WavRenderInput {
  readonly plan: ExportPlan;
  readonly audio: ExportAudio;
  /** The song's title for LIST/INFO INAM; null without one. */
  readonly songTitle: string | null;
  readonly onProgress: (done: number, total: number) => void;
  readonly isCancelled: () => boolean;
}

export type WavRenderResult =
  | { readonly kind: "done"; readonly blob: Blob; readonly frames: number }
  | { readonly kind: "cancelled" };

export async function renderWav(input: WavRenderInput): Promise<WavRenderResult> {
  const { plan, audio } = input;
  const second = plan.sampleRate;
  const parts: BlobPart[] = [];
  const totalSeconds = Math.ceil(plan.musicFrames / second);
  let held: AudioBlock | null = null;
  for (let done = 0; done < plan.musicFrames; done += second) {
    if (input.isCancelled()) return { kind: "cancelled" };
    if (held !== null) parts.push(encodePcm24(held.left, held.right) as Uint8Array<ArrayBuffer>);
    held = audio.read(Math.min(second, plan.musicFrames - done));
    input.onProgress(Math.min(totalSeconds, done / second + 1), totalSeconds);
    await yieldToEvents(); // lets a cancel message in
  }
  const tail = audio.read(plan.maxTailSeconds * second);
  const tailFrames = tailLength(tail, Math.round(SILENCE_SECONDS * second));
  const last = join(held, tail, tailFrames);
  const frames = plan.musicFrames + tailFrames;
  applyFade(last, frames - last.left.length, frames, Math.min(frames, Math.round(WAV_FADE_SECONDS * second)));
  parts.push(encodePcm24(last.left, last.right) as Uint8Array<ArrayBuffer>);
  const info = infoChunk(WAV_INFO, input.songTitle);
  const header = wavHeader(frames, plan.sampleRate, info.length);
  return {
    kind: "done",
    blob: new Blob([header as Uint8Array<ArrayBuffer>, ...parts, info as Uint8Array<ArrayBuffer>], { type: WAV_MIME }),
    frames,
  };
}

/** Where the tail falls silent: the start of the first window of silence, or its whole length. */
export function tailLength(tail: AudioBlock, silenceFrames: number): number {
  let silentSince = 0;
  for (let index = 0; index < tail.left.length; index += 1) {
    const loud = Math.abs(tail.left[index] ?? 0) >= SILENCE_LEVEL || Math.abs(tail.right[index] ?? 0) >= SILENCE_LEVEL;
    if (loud) silentSince = index + 1;
    else if (index + 1 - silentSince >= silenceFrames) return silentSince;
  }
  return tail.left.length;
}

function join(held: AudioBlock | null, tail: AudioBlock, tailFrames: number): AudioBlock {
  const head = held?.left.length ?? 0;
  const left = new Float32Array(head + tailFrames);
  const right = new Float32Array(head + tailFrames);
  if (held !== null) {
    left.set(held.left, 0);
    right.set(held.right, 0);
  }
  left.set(tail.left.subarray(0, tailFrames), head);
  right.set(tail.right.subarray(0, tailFrames), head);
  return { left, right };
}
