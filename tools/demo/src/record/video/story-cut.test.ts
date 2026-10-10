// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { FPS, TITLE_CARD_FRAMES } from "../frame-time";
import { STORY_BODY_SECONDS, joinWavSpans, storyCut, wavFrames } from "./story-cut";

const LIMIT = STORY_BODY_SECONDS * FPS;

/** A 16-bit stereo WAV whose sample at frame f is f on the left and -f on the right. */
function rampWav(frames: number): Uint8Array {
  const data = new Uint8Array(frames * 4);
  const view = new DataView(data.buffer);
  for (let frame = 0; frame < frames; frame += 1) {
    view.setInt16(frame * 4, frame, true);
    view.setInt16(frame * 4 + 2, -frame, true);
  }
  const header = new Uint8Array(44);
  const head = new DataView(header.buffer);
  const ascii = (at: number, text: string): void => [...text].forEach((character, index) => (header[at + index] = character.charCodeAt(0)));
  ascii(0, "RIFF");
  head.setUint32(4, 36 + data.length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  head.setUint32(16, 16, true);
  head.setUint16(20, 1, true);
  head.setUint16(22, 2, true);
  head.setUint32(24, 48_000, true);
  head.setUint32(28, 48_000 * 4, true);
  head.setUint16(32, 4, true);
  head.setUint16(34, 16, true);
  ascii(36, "data");
  head.setUint32(40, data.length, true);
  const file = new Uint8Array(44 + data.length);
  file.set(header);
  file.set(data, 44);
  return file;
}

function sampleAt(wav: Uint8Array, frame: number, channel: 0 | 1): number {
  return new DataView(wav.buffer, wav.byteOffset).getInt16(44 + frame * 4 + channel * 2, true);
}

describe("storyCut", () => {
  it("starts on the earliest layer after which the rest fits in 56 s", () => {
    const captured = TITLE_CARD_FRAMES + 3 * 60 * FPS;
    const layers = [TITLE_CARD_FRAMES, captured - LIMIT - 30, captured - LIMIT + 300, captured - 900];
    expect(storyCut(layers, captured)).toEqual({ fromFrame: captured - LIMIT + 300, frames: LIMIT - 300, isOnLayer: true });
  });
  it("cuts inside a layer when no layer start fits, and keeps a short capture whole", () => {
    const captured = TITLE_CARD_FRAMES + 3 * 60 * FPS;
    expect(storyCut([TITLE_CARD_FRAMES], captured)).toEqual({ fromFrame: captured - LIMIT, frames: LIMIT, isOnLayer: false });
    expect(storyCut([TITLE_CARD_FRAMES, 200], 900)).toEqual({ fromFrame: TITLE_CARD_FRAMES, frames: 900 - TITLE_CARD_FRAMES, isOnLayer: true });
  });
});

describe("joinWavSpans", () => {
  it("puts the spans one after the other and fades in each join", () => {
    const wav = rampWav(1_000);
    const joined = joinWavSpans(wav, [{ from: 0, to: 100 }, { from: 600, to: 800 }], 10);
    expect(wavFrames(joined)).toBe(300);
    expect(sampleAt(joined, 99, 0)).toBe(99);
    expect(sampleAt(joined, 100, 0)).toBe(0);
    expect(sampleAt(joined, 105, 0)).toBe(Math.round((605 * 5) / 10));
    expect(sampleAt(joined, 105, 1)).toBe(Math.round((-605 * 5) / 10));
    expect(sampleAt(joined, 110, 0)).toBe(610);
    expect(sampleAt(joined, 299, 1)).toBe(-799);
  });
  it("refuses a file that is not a WAV", () => {
    expect(() => wavFrames(new Uint8Array(64))).toThrow("not a WAV file");
  });
});
