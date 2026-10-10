// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The frame composer's draw order at the plan's size, against a recording canvas: the
// light, then the mark, then the song's title card (the first 45 frames) or its caption.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FrameComposer } from "./frame-composer";

const drawn: { readonly canvas: string; readonly what: string; readonly size: readonly number[] }[] = [];

class RecordingCanvas {
  static count = 0;
  readonly name: string;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    RecordingCanvas.count += 1;
    this.name = `canvas${RecordingCanvas.count}`;
  }
  getContext() {
    const canvas = this.name;
    return {
      globalAlpha: 1,
      drawImage: (image: { label?: string; name?: string }, ...size: number[]) => drawn.push({ canvas, what: image.label ?? image.name ?? "?", size }),
    };
  }
}

const bitmap = (label: string) => ({ label }) as unknown as ImageBitmap;
const branding = { mark: bitmap("mark"), card: bitmap("card") };

beforeEach(() => {
  drawn.length = 0;
  RecordingCanvas.count = 0;
  vi.stubGlobal("OffscreenCanvas", RecordingCanvas);
});
afterEach(() => vi.unstubAllGlobals());

const title = { card: bitmap("titleCard"), caption: bitmap("caption") };
const light = { label: "light" } as unknown as OffscreenCanvas;
/** What each light frame draws, and the alpha the title card was drawn at. */
function drawsAt(frame: number, reducedMotion = false): string[] {
  const composer = new FrameComposer({ frame: { width: 1080, height: 1920 }, branding, reducedMotion, title });
  drawn.length = 0;
  composer.light(light, frame);
  return drawn.map((call) => call.what);
}
describe("FrameComposer", () => {
  it("draws the light at the frame's size and the mark over it; with title: null, only those", () => {
    const composer = new FrameComposer({ frame: { width: 3840, height: 2160 }, branding, reducedMotion: false, title: null });
    composer.light(light, 0);
    expect(drawn.map((call) => call.what)).toEqual(["light", "mark"]);
    expect(drawn[0]?.size).toEqual([0, 0, 3840, 2160]);
  });
  it("frames 0 and 44: light, mark, then the title card", () => {
    expect(drawsAt(0)).toEqual(["light", "mark", "titleCard"]);
    expect(drawsAt(44)).toEqual(["light", "mark", "titleCard"]);
  });
  it("frame 45 on: light, mark, then the caption", () => {
    expect(drawsAt(45)).toEqual(["light", "mark", "caption"]);
    expect(drawsAt(900)).toEqual(["light", "mark", "caption"]);
  });
  it("never draws the card and the caption on one frame, and the mark on every one", () => {
    for (const reducedMotion of [false, true]) {
      for (let frame = 0; frame < 120; frame += 1) {
        const what = drawsAt(frame, reducedMotion);
        expect(what.filter((name) => name === "titleCard" || name === "caption"), `${frame}`).toHaveLength(1);
        expect(what.indexOf("mark"), `${frame}`).toBe(1);
      }
    }
  });
  it("ends on the whole card, which carries no title", () => {
    const composer = new FrameComposer({ frame: { width: 1080, height: 1920 }, branding, reducedMotion: true, title });
    expect(composer.card(0)).toBe(branding.card);
  });
});
