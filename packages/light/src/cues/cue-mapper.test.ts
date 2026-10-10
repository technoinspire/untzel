// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { GeneralParameter } from "@untzel/core";
import type { ActivatedModulator, ActivatedTrack, ParameterPoint, ProgramActivation, ScheduledBatch } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { MEASURED_KEEP_OUT } from "@untzel/scene/testing";
import { registryWith } from "@untzel/instrument-index/testing";
import { LightCueMapper } from "./cue-mapper";
// Scheduled events and points → the light: a new generation is a program, a
// re-sent one only a change of audibility, and the light follows what the DSP plays.

const SAMPLE_RATE = 48_000;
const registry = registryWith(["kick", "hat"]);
const position = { frame: 0, bar: 0, mode: "loop", partIndex: null, section: null, barInPart: null, totalBars: null, patternBar: 0, loopBar: null, loopBars: null, framesPerBar: 96_000 } as const;

const GAIN_LFO: ActivatedModulator = { kind: "lfo", index: GeneralParameter.gain, shape: 0, curve: 0, periodFrames: 96_000, originFrame: 0, low: 0, high: 1 };

function track(name: string, instrument: string, options: { readonly isMuted?: boolean; readonly modulators?: readonly ActivatedModulator[] } = {}): ActivatedTrack {
  const parameters = Array.from({ length: 40 }, () => 0);
  parameters[GeneralParameter.gain] = 1;
  parameters[GeneralParameter.audible] = 1;
  return { name, instrument, parameters, effects: [], modulators: options.modulators ?? [], isMuted: options.isMuted ?? false, isAudible: !(options.isMuted ?? false) };
}

function activation(generation: number, tracks: readonly ActivatedTrack[], atFrame = 0): ProgramActivation {
  return { generation, atFrame, tracks, lightSourceHash: 11, stagePlanHash: 11 };
}

function batch(events: readonly { readonly generation: number; readonly trackIndex: number; readonly frame: number }[], parameters: readonly ParameterPoint[] = []): ScheduledBatch {
  return {
    events: events.map((event) => ({ ...event, durationFrames: 4800, value: { kind: "hit", accent: true }, velocity: 1, source: { from: 10, to: 11 } })),
    parameters,
    position,
  };
}

function point(trackIndex: number, parameter: number, value: number, frame: number): ParameterPoint {
  return { frame, generation: 1, trackIndex, parameter, value, rampFrames: 0, isConstant: true };
}

describe("LightCueMapper", () => {
  it("names each event's track from the activation of its generation", () => {
    const mapper = new LightCueMapper(registry, MEASURED_KEEP_OUT);
    const program = mapper.activate(activation(1, [track("kick", "kick"), track("ride", "hat")]), SAMPLE_RATE);
    expect(program).toMatchObject({ audioTime: 0, lightSourceHash: 11 });
    const [cue] = mapper.cues(batch([{ generation: 1, trackIndex: 1, frame: 48_000 }]), SAMPLE_RATE).cues;
    expect(cue).toMatchObject({ track: "ride", audioTime: 1, duration: 0.1, isAccent: true, bar: 0, tick: 48 });
  });

  it("drops events of a generation it never saw", () => {
    const mapper = new LightCueMapper(registry, MEASURED_KEEP_OUT);
    expect(mapper.cues(batch([{ generation: 7, trackIndex: 0, frame: 0 }]), SAMPLE_RATE).cues).toEqual([]);
  });

  it("places every track, a muted one too, so mute never moves the scenes", () => {
    const mapper = new LightCueMapper(registry, MEASURED_KEEP_OUT);
    const program = mapper.activate(activation(1, [track("kick", "kick", { isMuted: true }), track("hat", "hat")]), SAMPLE_RATE);
    if (program === null || !("anchors" in program)) throw new Error("a program expected");
    expect([...program.anchors.keys()]).toEqual(["kick", "hat"]);
    expect([...program.audible]).toEqual(["hat"]);
  });

  it("turns a re-sent activation into a change of audibility only, or nothing", () => {
    const mapper = new LightCueMapper(registry, MEASURED_KEEP_OUT);
    mapper.activate(activation(1, [track("kick", "kick"), track("hat", "hat")]), SAMPLE_RATE);
    expect(mapper.activate(activation(1, [track("kick", "kick"), track("hat", "hat")], 96_000), SAMPLE_RATE)).toBeNull();
    const change = mapper.activate(activation(1, [track("kick", "kick", { isMuted: true }), track("hat", "hat")], 192_000), SAMPLE_RATE);
    expect(change).toEqual({ audioTime: 4, audible: new Set(["hat"]) });
  });

  it("follows the solo: the soloed-out track goes dark at the point and returns at the next", () => {
    const mapper = new LightCueMapper(registry, MEASURED_KEEP_OUT);
    mapper.activate(activation(1, [track("kick", "kick"), track("hat", "hat")]), SAMPLE_RATE);
    const { audibility } = mapper.cues(batch([], [point(1, GeneralParameter.audible, 0, 48_000), point(1, GeneralParameter.audible, 1, 96_000)]), SAMPLE_RATE);
    expect(audibility).toEqual([
      { audioTime: 1, audible: new Set(["kick"]) },
      { audioTime: 2, audible: new Set(["kick", "hat"]) },
    ]);
  });

  it("goes dark on a constant gain of 0, but not when a gain LFO owns the index (the DSP ignores the write)", () => {
    const mapper = new LightCueMapper(registry, MEASURED_KEEP_OUT);
    mapper.activate(activation(1, [track("kick", "kick"), track("hat", "hat", { modulators: [GAIN_LFO] })]), SAMPLE_RATE);
    const { audibility } = mapper.cues(batch([], [point(0, GeneralParameter.gain, 0, 48_000), point(1, GeneralParameter.gain, 0, 48_000)]), SAMPLE_RATE);
    expect(audibility).toEqual([{ audioTime: 1, audible: new Set(["hat"]) }]);
  });
});
