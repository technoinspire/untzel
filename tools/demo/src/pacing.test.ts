// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { DemoScript } from "./actions";
import { BEATS_PER_BAR, BURST_LINE_SECONDS, DEFAULT_GESTURE_SECONDS, DEFAULT_PACING, barAndBeat, planTimeline } from "./pacing";

const SCRIPT: DemoScript = {
  layers: [
    {
      name: "kick",
      role: "kick",
      actions: [
        { kind: "addTrack", instrument: "kick", track: "kick", preset: null },
        { kind: "setParameter", track: "kick", parameter: "drive", value: 0.3 },
        { kind: "togglePlay" },
      ],
    },
    {
      name: "hat",
      role: "percussion",
      actions: [
        { kind: "addTrack", instrument: "hat", track: "hat", preset: null },
        { kind: "toggleStep", track: "hat", bar: 0, step: 15 },
      ],
    },
    {
      name: "arrangement",
      role: "arrangement",
      actions: [{ kind: "typeCode", placement: { kind: "appendLine" }, text: "section intro kick hat", reason: "section", pace: "keys" }],
    },
  ],
};

const isOnBarLine = (beat: number): boolean => Math.abs(beat / BEATS_PER_BAR - Math.round(beat / BEATS_PER_BAR)) < 1e-9;

describe("planTimeline", () => {
  it("starts every layer on a bar line and lets it enter on the next one", () => {
    const timeline = planTimeline(SCRIPT, 132);
    for (const [index, layer] of timeline.layers.entries()) {
      const actions = timeline.actions.filter((entry) => entry.layer === index);
      const lastEnd = Math.max(...actions.map((entry) => entry.startBeat + entry.beats));
      expect(isOnBarLine(layer.startBeat)).toBe(true);
      expect(isOnBarLine(layer.entersBeat)).toBe(true);
      expect(layer.entersBeat).toBeGreaterThanOrEqual(lastEnd - 1e-9);
      expect(layer.entersBeat - lastEnd).toBeLessThan(BEATS_PER_BAR);
    }
  });

  it("plays the gestures one after the other, in script order", () => {
    const timeline = planTimeline(SCRIPT, 120);
    timeline.actions.slice(1).forEach((entry, index) => {
      const previous = timeline.actions[index];
      if (previous !== undefined && previous.layer === entry.layer) {
        expect(entry.startBeat).toBeCloseTo(previous.startBeat + previous.beats, 9);
      }
    });
    // At 120 bpm one second is two beats.
    expect(timeline.actions[0]?.beats).toBeCloseTo(DEFAULT_GESTURE_SECONDS.addTrack * 2, 9);
  });

  it("keeps human seconds whatever the tempo: more beats at a faster tempo", () => {
    const slow = planTimeline(SCRIPT, 100).actions[0]?.beats ?? 0;
    const fast = planTimeline(SCRIPT, 150).actions[0]?.beats ?? 0;
    expect(fast / slow).toBeCloseTo(1.5, 9);
  });

  it("types Code at reading speed", () => {
    const timeline = planTimeline(SCRIPT, 120, { typingCharsPerSecond: 11 });
    const typing = timeline.actions.at(-1);
    const seconds = DEFAULT_GESTURE_SECONDS.typeCode + "section intro kick hat".length / 11;
    expect(typing?.beats).toBeCloseTo(seconds * 2, 9);
  });
  it("types a line in bursts at the burst speed, into the panel already open", () => {
    const text = "hat: hat ..x. ..x. ..x. ..x. | gain 0.5";
    const burst = { kind: "typeCode", placement: { kind: "appendLine" }, text, reason: "band", pace: "bursts" } as const;
    const script = { layers: [{ name: "band", role: "band", actions: [burst] }] } as const;
    const plain = planTimeline(script, 120).actions[0]?.beats ?? 0;
    expect(plain).toBeCloseTo((BURST_LINE_SECONDS + text.length / DEFAULT_PACING.burstCharsPerSecond) * 2, 9);
    const slower = planTimeline(script, 120, { burstCharsPerSecond: 30, typingCharsPerSecond: 99 }).actions[0]?.beats ?? 0;
    expect(slower).toBeCloseTo((BURST_LINE_SECONDS + text.length / 30) * 2, 9);
  });

  it("adds intro, listening and outro bars from the defaults and the demo file", () => {
    const plain = planTimeline(SCRIPT, 132);
    expect(plain.layers[0]?.startBeat).toBe(DEFAULT_PACING.introBars * BEATS_PER_BAR);
    const first = plain.layers[0];
    expect(first === undefined ? 0 : first.endBeat - first.entersBeat).toBe(DEFAULT_PACING.listenBars * BEATS_PER_BAR);
    const lastEnd = plain.layers.at(-1)?.endBeat ?? 0;
    expect(plain.totalBeats).toBe(lastEnd + DEFAULT_PACING.outroBars * BEATS_PER_BAR);

    const tuned = planTimeline(SCRIPT, 132, { introBars: 2, listenBars: 1, outroBars: 4, layers: { kick: { listenBars: 6 } } });
    expect(tuned.layers[0]?.startBeat).toBe(8);
    const kick = tuned.layers[0];
    const hat = tuned.layers[1];
    expect(kick === undefined ? 0 : kick.endBeat - kick.entersBeat).toBe(24);
    expect(hat === undefined ? 0 : hat.endBeat - hat.entersBeat).toBe(4);
    expect(tuned.totalBeats).toBe((tuned.layers.at(-1)?.endBeat ?? 0) + 16);
  });

  it("overrides the seconds of one kind of gesture", () => {
    const timeline = planTimeline(SCRIPT, 120, { gestureSeconds: { toggleStep: 2 } });
    const tap = timeline.actions.find((entry) => entry.action.kind === "toggleStep");
    expect(tap?.beats).toBe(4);
  });

  it("reports the total in seconds at the tempo", () => {
    const timeline = planTimeline(SCRIPT, 120);
    expect(timeline.totalSeconds).toBeCloseTo(timeline.totalBeats / 2, 9);
  });

  it("rejects a tempo that is not positive", () => {
    expect(() => planTimeline(SCRIPT, 0)).toThrow(RangeError);
  });
});

describe("barAndBeat", () => {
  it("counts from bar 1, beat 1", () => {
    expect(barAndBeat(0)).toEqual({ bar: 1, beat: 1 });
    expect(barAndBeat(5.5)).toEqual({ bar: 2, beat: 2.5 });
  });
});
