// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { MainToWorkletMessage, SamplePackData } from "../protocol";
import { SamplePackSender, packMessages } from "./sample-pack-sender";

const pack = (instrumentId: number, frames: number): SamplePackData => ({
  instrumentId,
  sampleRate: 48_000,
  pcm: Int16Array.from({ length: frames }, (_, i) => i),
  zones: new Float64Array(8),
});

describe("packMessages", () => {
  it("is a begin, chunks that cover every frame once, then a commit", () => {
    const source = pack(3, 10);
    const messages = packMessages(source, 4).map((piece) => piece.message);
    expect(messages.map((m) => m.type)).toEqual(["samplePackBegin", "samplePackChunk", "samplePackChunk", "samplePackChunk", "samplePackCommit"]);
    const chunks = messages.filter((m): m is Extract<MainToWorkletMessage, { type: "samplePackChunk" }> => m.type === "samplePackChunk");
    expect(chunks.map((m) => [m.offset, m.pcm.length])).toEqual([[0, 4], [4, 4], [8, 2]]);
    expect(Array.from(chunks.flatMap((m) => Array.from(m.pcm)))).toEqual(Array.from(source.pcm));
  });

  it("transfers copies: the page keeps its pack whole for the export", () => {
    const source = pack(1, 6);
    for (const { message, transfer } of packMessages(source, 4)) {
      if (message.type === "samplePackChunk") expect(transfer).toEqual([message.pcm.buffer]);
      if (message.type === "samplePackBegin") expect(transfer).toEqual([message.zones.buffer]);
    }
    expect(source.pcm.length).toBe(6);
    expect(source.zones.length).toBe(8);
  });
});

describe("SamplePackSender", () => {
  it("sends one piece at a time, the next only when the worklet took the last", () => {
    const sent: string[] = [];
    const sender = new SamplePackSender({ postMessage: (message) => sent.push(message.type) });
    sender.send(pack(1, 3));
    sender.send(pack(2, 3));
    expect(sent).toEqual(["samplePackBegin"]);
    sender.onTaken();
    sender.onTaken();
    expect(sent).toEqual(["samplePackBegin", "samplePackChunk", "samplePackCommit"]);
    sender.onTaken();
    expect(sent.at(-1)).toBe("samplePackBegin");
  });
});
