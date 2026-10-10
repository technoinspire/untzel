// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The Story cut: a Story lasts 1:00 at most, cards
// included, so it keeps the title card and the end of the build: from the earliest layer
// start after which the rest of the capture fits in 56 s. Pure.
import { FPS, TITLE_CARD_FRAMES } from "../frame-time";

/** 1:00 less the title card and the brand's closing card, rounded down to the second. */
export const STORY_BODY_SECONDS = 56;

export interface StoryCut {
  /** The first captured frame after the title card that the Story keeps. */
  readonly fromFrame: number;
  /** Frames of the capture the Story keeps after its title card. */
  readonly frames: number;
  /** False when no layer start fit and the cut falls inside a layer. */
  readonly isOnLayer: boolean;
}

/**
 * `layerFrames`: the frame each layer starts on; `capturedFrames`: frames from the arm to the
 * end of the take, the title card included.
 */
export function storyCut(layerFrames: readonly number[], capturedFrames: number): StoryCut {
  const limit = STORY_BODY_SECONDS * FPS;
  const candidates = layerFrames.filter((frame) => frame >= TITLE_CARD_FRAMES && capturedFrames - frame <= limit);
  const onLayer = candidates.length === 0 ? null : Math.min(...candidates);
  const fromFrame = onLayer ?? Math.max(TITLE_CARD_FRAMES, capturedFrames - limit);
  return { fromFrame, frames: capturedFrames - fromFrame, isOnLayer: onLayer !== null };
}

/** A run of sample frames of a sound track, [from, to). */
export interface SampleSpan {
  readonly from: number;
  readonly to: number;
}

interface WavParts {
  readonly format: Uint8Array;
  readonly data: Uint8Array;
  readonly channels: number;
  readonly bytesPerSample: number;
}

function readWav(bytes: Uint8Array): WavParts {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number): string => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a WAV file");
  let format: Uint8Array | null = null;
  let data: Uint8Array | null = null;
  for (let at = 12; at + 8 <= bytes.length; ) {
    const size = view.getUint32(at + 4, true);
    const body = bytes.subarray(at + 8, at + 8 + size);
    if (tag(at) === "fmt ") format = body;
    if (tag(at) === "data") data = body;
    at += 8 + size + (size % 2);
  }
  if (format === null || data === null) throw new Error("a WAV file without fmt or data");
  const formatView = new DataView(format.buffer, format.byteOffset, format.byteLength);
  return { format, data, channels: formatView.getUint16(2, true), bytesPerSample: formatView.getUint16(14, true) / 8 };
}

function readSample(data: Uint8Array, at: number, bytes: number): number {
  let value = 0;
  for (let index = bytes - 1; index >= 0; index -= 1) value = value * 256 + (data[at + index] ?? 0);
  const limit = 2 ** (8 * bytes - 1);
  return value >= limit ? value - 2 * limit : value;
}

function writeSample(data: Uint8Array, at: number, bytes: number, value: number): void {
  let rest = value < 0 ? value + 2 ** (8 * bytes) : value;
  for (let index = 0; index < bytes; index += 1) {
    data[at + index] = rest % 256;
    rest = Math.floor(rest / 256);
  }
}

/**
 * The Story's sound: `spans` of `wav` one after the other, each after the first faded in
 * over `fadeInFrames` (the export's 10 ms at a join). Pure; the format is the input's.
 */
export function joinWavSpans(wav: Uint8Array, spans: readonly SampleSpan[], fadeInFrames: number): Uint8Array {
  const { format, data, channels, bytesPerSample } = readWav(wav);
  const frameBytes = channels * bytesPerSample;
  const total = spans.reduce((sum, span) => sum + (span.to - span.from), 0);
  const out = new Uint8Array(total * frameBytes);
  let written = 0;
  spans.forEach((span, index) => {
    out.set(data.subarray(span.from * frameBytes, span.to * frameBytes), written * frameBytes);
    if (index > 0) {
      for (let frame = 0; frame < Math.min(fadeInFrames, span.to - span.from); frame += 1) {
        for (let channel = 0; channel < channels; channel += 1) {
          const at = (written + frame) * frameBytes + channel * bytesPerSample;
          writeSample(out, at, bytesPerSample, Math.round((readSample(out, at, bytesPerSample) * frame) / fadeInFrames));
        }
      }
    }
    written += span.to - span.from;
  });
  const header = new Uint8Array(12 + 8 + format.length + 8);
  const view = new DataView(header.buffer);
  const ascii = (at: number, text: string): void => [...text].forEach((character, index) => (header[at + index] = character.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, header.length - 8 + out.length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, format.length, true);
  header.set(format, 20);
  ascii(20 + format.length, "data");
  view.setUint32(24 + format.length, out.length, true);
  const file = new Uint8Array(header.length + out.length);
  file.set(header);
  file.set(out, header.length);
  return file;
}

/** Sample frames in a WAV file's data. */
export function wavFrames(wav: Uint8Array): number {
  const { data, channels, bytesPerSample } = readWav(wav);
  return data.length / (channels * bytesPerSample);
}
