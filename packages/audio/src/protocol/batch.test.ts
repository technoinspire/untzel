// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ScheduledBatch, ScheduledEvent } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { HIT_NOTE, packBatch, toWorkletProgram, unpackBatch } from "./index";

const position = {
  frame: 0,
  bar: 0,
  mode: "loop",
  partIndex: null,
  section: null,
  barInPart: null,
  totalBars: null,
  patternBar: 0,
  loopBar: null,
  loopBars: null, framesPerBar: 96_000,
} as const;

function event(frame: number, value: ScheduledEvent["value"], velocity = 0.8): ScheduledEvent {
  return {
    frame,
    durationFrames: 1200,
    generation: 3,
    trackIndex: 2,
    value,
    velocity,
    source: { from: 0, to: 1 },
  };
}

describe("packBatch / unpackBatch", () => {
  it("round-trips an accented hit, a note, a 4-note chord and a parameter point", () => {
    const batch: ScheduledBatch = {
      events: [
        event(128, { kind: "hit", accent: true }, 1),
        event(256, { kind: "note", midi: 36, writtenMidi: 37 }),
        event(512, { kind: "chord", midis: [48, 51, 55, 58] }),
      ],
      parameters: [
        { frame: 640, generation: 3, trackIndex: 1, parameter: 16, value: 648.07, rampFrames: 882, isConstant: false },
      ],
      position,
    };
    const data = packBatch(batch);
    expect(data.length).toBe(2 + 6 * 6 + 6);
    const { events, points } = unpackBatch(data);
    expect(events.map((e) => e.note)).toEqual([HIT_NOTE, 36, 48, 51, 55, 58]);
    expect(events[0]).toEqual({
      frame: 128,
      durationFrames: 1200,
      generation: 3,
      trackIndex: 2,
      note: HIT_NOTE,
      velocity: 1,
    });
    expect(events.slice(2).every((e) => e.frame === 512 && e.velocity === 0.8)).toBe(true);
    expect(points).toEqual(batch.parameters.map(({ isConstant: _, ...point }) => point));
  });

  it("round-trips an empty batch", () => {
    const data = packBatch({ events: [], parameters: [] });
    expect(Array.from(data)).toEqual([0, 0]);
    expect(unpackBatch(data)).toEqual({ events: [], points: [] });
  });

  it("rejects a header that does not match the length", () => {
    expect(() => unpackBatch(new Float64Array([1, 0]))).toThrow(RangeError);
  });
});

describe("toWorkletProgram", () => {
  it("maps instrument names to instrumentId and keeps everything else", () => {
    const message = toWorkletProgram(
      {
        generation: 1,
        atFrame: 5120,
        lightSourceHash: 1,
        stagePlanHash: 1,
        tracks: [
          { name: "sub", instrument: "bass", parameters: [1, 0], effects: [2], modulators: [], isMuted: false, isAudible: true },
          { name: "kick", instrument: "kick", parameters: [0.9], effects: [], modulators: [], isMuted: false, isAudible: true },
          { name: "pad", instrument: "pad", parameters: [], effects: [], modulators: [], isMuted: false, isAudible: true },
        ],
      },
      ["bass", "hat", "kick"],
    );
    expect(message.type).toBe("program");
    expect(message.atFrame).toBe(5120);
    expect(message.tracks.map((t) => t.instrumentId)).toEqual([0, 2, 0xffffffff]);
    expect(message.tracks[0]?.parameters).toEqual([1, 0]);
  });
});
