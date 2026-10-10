// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import {
  InstanceTable,
  NO_SLOT,
  UNKNOWN_TARGET,
  type InstanceDsp,
  type ProgramMessage,
} from "./instance-table";

const SAMPLE_RATE = 48_000;

class FakeDsp implements InstanceDsp {
  readonly calls: string[] = [];
  #next = 0;
  untzel_instance_create(instrumentId: number): number {
    if (instrumentId === 0xffffffff) return -1;
    const slot = this.#next++;
    this.calls.push(`create ${instrumentId} -> ${slot}`);
    return slot;
  }
  untzel_param_set(slot: number, param: number, value: number): void {
    this.calls.push(`set ${slot} ${param}=${value}`);
  }
  untzel_param_push(slot: number, param: number, frame: number, value: number, ramp: number): number {
    this.calls.push(`push ${slot} ${param}=${value} @${frame} ramp ${ramp}`);
    return 0;
  }
  untzel_instance_activate(slot: number, atFrame: number): void {
    this.calls.push(`activate ${slot} @${atFrame}`);
  }
  untzel_instance_retire(slot: number, atFrame: number): void {
    this.calls.push(`retire ${slot} @${atFrame}`);
  }
  untzel_effect_order(slot: number, position: number, kind: number): number {
    this.calls.push(`order ${slot} ${position}=${kind}`);
    return kind > 8 ? 1 : 0;
  }
  untzel_effects_commit(slot: number, count: number, atFrame: number): number {
    this.calls.push(`commit ${slot} ${count} @${atFrame}`);
    return 0;
  }
  untzel_modulator_set(slot: number, param: number, shape: number, curve: number, period: number, origin: number, low: number, high: number): number {
    this.calls.push(`lfo ${slot} ${param} shape ${shape} curve ${curve} ${period}/${origin} ${low}..${high}`);
    return 0;
  }
  untzel_envelope_set(slot: number, param: number, curve: number, seconds: number, from: number, to: number): number {
    this.calls.push(`env ${slot} ${param} curve ${curve} ${seconds}s ${from}..${to}`);
    return 0;
  }
  untzel_modulator_clear(slot: number, param: number): number {
    this.calls.push(`clear ${slot} ${param}`);
    return 0;
  }
}

type Modulators = ProgramMessage["tracks"][number]["modulators"];
type Track = [name: string, instrumentId: number, parameters?: number[], effects?: number[], modulators?: Modulators];

function program(generation: number, atFrame: number, tracks: Track[]): ProgramMessage {
  return {
    type: "program",
    generation,
    atFrame,
    tracks: tracks.map(([name, instrumentId, parameters = [1, 0], effects = [], modulators = []]) => ({
      name,
      instrumentId,
      parameters,
      effects,
      modulators,
    })),
  };
}

function setup() {
  const dsp = new FakeDsp();
  const table = new InstanceTable(dsp, SAMPLE_RATE);
  table.activate(program(1, 1000, [["kick", 2], ["sub", 0], ["bass", 0]]));
  dsp.calls.length = 0;
  return { dsp, table };
}

describe("InstanceTable", () => {
  it("creates one slot per name with initial values and activation", () => {
    const dsp = new FakeDsp();
    const table = new InstanceTable(dsp, SAMPLE_RATE);
    table.activate(program(1, 1000, [["kick", 2, [0.9, 0]]]));
    expect(dsp.calls).toEqual(["create 2 -> 0", "set 0 0=0.9", "set 0 1=0", "activate 0 @1000"]);
    expect(table.slotOf(1, 0)).toBe(0);
  });

  it("keeps the slot when lines are reordered or the pattern changes", () => {
    const { dsp, table } = setup();
    table.activate(program(2, 5000, [["bass", 0], ["kick", 2], ["sub", 0]]));
    expect(dsp.calls).toEqual([]);
    expect([table.slotOf(2, 0), table.slotOf(2, 1), table.slotOf(2, 2)]).toEqual([2, 0, 1]);
  });

  it("ramps only the parameters that changed, over 20 ms", () => {
    const { dsp, table } = setup();
    table.activate(program(2, 5000, [["kick", 2, [0.5, 0]], ["sub", 0], ["bass", 0]]));
    expect(dsp.calls).toEqual(["push 0 0=0.5 @5000 ramp 960"]);
  });

  it("creates a new slot on rename and retires the old one", () => {
    const { dsp, table } = setup();
    table.activate(program(2, 5000, [["kick", 2], ["sub", 0], ["low", 0]]));
    expect(dsp.calls).toEqual([
      "create 0 -> 3",
      "set 3 0=1",
      "set 3 1=0",
      "activate 3 @5000",
      "retire 2 @5000",
    ]);
  });

  it("retires and creates when a name changes instrument", () => {
    const { dsp, table } = setup();
    table.activate(program(2, 5000, [["kick", 1], ["sub", 0], ["bass", 0]]));
    expect(dsp.calls.slice(0, 2)).toEqual(["retire 0 @5000", "create 1 -> 3"]);
    expect(table.slotOf(2, 0)).toBe(3);
  });

  it("retires a removed name", () => {
    const { dsp, table } = setup();
    table.activate(program(2, 5000, [["kick", 2], ["sub", 0]]));
    expect(dsp.calls).toEqual(["retire 2 @5000"]);
  });

  it("drops an old generation one second after the next one starts", () => {
    const { table } = setup();
    table.activate(program(2, 5000, [["kick", 2], ["sub", 0], ["bass", 0]]));
    table.discardGenerations(5000 + SAMPLE_RATE - 1);
    expect(table.generations()).toEqual([1, 2]);
    table.discardGenerations(5000 + SAMPLE_RATE);
    expect(table.generations()).toEqual([2]);
    expect(table.slotOf(1, 0)).toBe(UNKNOWN_TARGET);
  });

  it("reports unknown targets and mute tracks apart", () => {
    const dsp = new FakeDsp();
    const table = new InstanceTable(dsp, SAMPLE_RATE);
    table.activate(program(1, 0, [["pad", 0xffffffff]]));
    expect(table.slotOf(1, 0)).toBe(NO_SLOT);
    expect(table.slotOf(1, 1)).toBe(UNKNOWN_TARGET);
    expect(table.slotOf(9, 0)).toBe(UNKNOWN_TARGET);
  });
});

describe("effects and modulators", () => {
  const lfo = { kind: "lfo", index: 40, shape: 0, curve: 1, periodFrames: 6000, originFrame: 0, low: 300, high: 2400 } as const;

  it("commits the order at the activation frame only when it changes", () => {
    const dsp = new FakeDsp();
    const table = new InstanceTable(dsp, SAMPLE_RATE);
    table.activate(program(1, 1000, [["pad", 0, [1], [2, 0]]]));
    expect(dsp.calls).toContain("order 0 0=2");
    expect(dsp.calls).toContain("order 0 1=0");
    expect(dsp.calls).toContain("commit 0 2 @1000");
    dsp.calls.length = 0;
    table.activate(program(2, 2000, [["pad", 0, [1], [2, 0]]]));
    expect(dsp.calls.filter((call) => call.startsWith("commit"))).toEqual([]);
    table.activate(program(3, 3000, [["pad", 0, [1], []]]));
    expect(dsp.calls).toContain("commit 0 0 @3000");
  });

  it("sets, keeps and clears modulators by parameter index", () => {
    const dsp = new FakeDsp();
    const table = new InstanceTable(dsp, SAMPLE_RATE);
    table.activate(program(1, 0, [["pad", 0, [1], [], [lfo]]]));
    expect(dsp.calls).toContain("lfo 0 40 shape 0 curve 1 6000/0 300..2400");
    dsp.calls.length = 0;
    table.activate(program(2, 100, [["pad", 0, [1], [], [lfo]]]));
    expect(dsp.calls.filter((call) => call.startsWith("lfo"))).toEqual([]);
    table.activate(program(3, 200, [["pad", 0, [1], [], []]]));
    expect(dsp.calls).toContain("clear 0 40");
  });

  it("counts refused calls", () => {
    const dsp = new FakeDsp();
    const table = new InstanceTable(dsp, SAMPLE_RATE);
    table.activate(program(1, 0, [["pad", 0, [1], [9]]]));
    expect(table.refusals.count).toBe(1);
  });
});
