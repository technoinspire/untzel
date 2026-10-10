// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { barGestures, gridGap, type StepCell } from "./pattern-steps";

const REST: StepCell = { kind: "rest" };
const HIT: StepCell = { kind: "hit" };
const C2: StepCell = { kind: "note", midi: 36 };
const EB2: StepCell = { kind: "note", midi: 39 };
const HELD: StepCell = { kind: "typed", reason: "sustain" };

describe("gridGap", () => {
  it("lets the grid draw rests and hits on drums and single notes on pitched tracks", () => {
    expect(gridGap([Array.from({ length: 16 }, (_, step) => (step % 4 === 0 ? HIT : REST))], false, 16)).toBeNull();
    expect(gridGap([[C2, REST, EB2, REST, C2, REST, REST, REST]], true, 8)).toBeNull();
  });

  it("names what the grid cannot draw", () => {
    expect(gridGap([], false, 16)).toBe("no-pattern");
    expect(gridGap([[HELD]], true, 8)).toBe("sustain");
    expect(gridGap([[HIT]], true, 8)).toBe("pitched-hit");
    expect(gridGap([[C2]], false, 16)).toBe("drum-note");
    expect(gridGap([[HIT, REST], [HIT, REST, REST, REST]], false, 16)).toBe("mixed-step-counts");
  });

  it("accepts only step counts the track detail offers and setStepCount can reach", () => {
    expect(gridGap([Array.from({ length: 32 }, () => REST)], false, 16)).toBeNull();
    expect(gridGap([Array.from({ length: 4 }, () => REST)], false, 16)).toBe("step-count");
    expect(gridGap([Array.from({ length: 12 }, () => REST)], false, 16)).toBe("step-count");
  });
});

describe("barGestures", () => {
  it("taps a rest into a hit and a hit into a rest", () => {
    expect(barGestures("kick", 0, [HIT, REST], [REST, HIT])).toEqual([
      { kind: "toggleStep", track: "kick", bar: 0, step: 0 },
      { kind: "toggleStep", track: "kick", bar: 0, step: 1 },
    ]);
  });

  it("puts notes with the NotePicker and leaves equal steps alone", () => {
    expect(barGestures("bass", 1, [C2, REST, HELD], [C2, EB2, REST])).toEqual([
      { kind: "setStepNote", track: "bass", bar: 1, step: 1, note: "eb2" },
      { kind: "toggleStep", track: "bass", bar: 1, step: 2 },
    ]);
  });

  it("clears a held step before tapping a hit", () => {
    expect(barGestures("hat", 0, [HELD], [HIT])).toHaveLength(2);
  });
});
