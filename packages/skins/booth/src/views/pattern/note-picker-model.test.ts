// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import type { StepPitch } from "@untzel/core";
import type { StepView } from "@untzel/presentation/view-model";
import {
  chordRootOf,
  midiOfPitch,
  octaveShifted,
  pickOutcome,
  pickerKeys,
  pitchLabel,
  pressedOutside,
  qualityChips,
  scaleWarning,
  shiftWindow,
  soundingMidis,
  spokenNote,
  startingMidi,
  stepPitchOf,
  stepStateLabel,
  windowStartFor,
  type KeyboardState,
} from "./note-picker-model";

const C_MINOR = [0, 2, 3, 5, 7, 8, 10];
const FULL = { lowest: 12, highest: 96 };
const note = (label: string): StepView => ({ kind: "note", label });
const rest: StepView = { kind: "rest", label: null };
const hold: StepView = { kind: "hold", label: null };
const keyboard = (sounding: StepPitch, changes: Partial<KeyboardState> = {}): KeyboardState => ({
  start: 48, scale: C_MINOR, isScaleLocked: true, sounding, pending: null, ...changes,
});
const pressed = (state: KeyboardState): string[] => pickerKeys(state).filter((key) => key.isPressed).map((key) => key.name);

describe("pressed keys: the keyboard shows what the step plays", () => {
  it("presses one key for a note, and nothing for a rest or a hold", () => {
    expect(pressed(keyboard({ kind: "note", note: "eb3" }))).toEqual(["eb3"]);
    expect(pressed(keyboard({ kind: "rest" }))).toEqual([]);
    expect(pressed(keyboard({ kind: "hold" }))).toEqual([]);
    expect(stepStateLabel({ kind: "rest" })).toBe("Rest");
    expect(stepStateLabel({ kind: "hold" })).toBe("Hold");
  });

  it("presses a triad and a seventh where the engine voices them, the root marked", () => {
    expect(pressed(keyboard({ kind: "chord", root: "C", quality: "m" }))).toEqual(["c3", "eb3", "g3"]);
    const cm7 = pickerKeys(keyboard({ kind: "chord", root: "C", quality: "m7" }));
    expect(cm7.filter((key) => key.isPressed).map((key) => key.name)).toEqual(["c3", "eb3", "g3", "bb3"]);
    expect(cm7.filter((key) => key.isRoot).map((key) => key.name)).toEqual(["c3"]);
    expect(cm7.find((key) => key.name === "eb3")?.label).toBe("E flat 3, in chord");
    expect(soundingMidis({ kind: "chord", root: "C", quality: "m7" })).toEqual([48, 51, 55, 58]);
  });

  it("marks the octave buttons when pressed keys lie outside the window", () => {
    const high = { kind: "chord", root: "A", quality: "m7" } as const;
    expect(pressedOutside(high, 36)).toEqual({ below: false, above: true });
    expect(pressedOutside(high, 60)).toEqual({ below: true, above: false });
    expect(pressedOutside(high, 48)).toEqual({ below: false, above: false });
    expect(pressedOutside({ kind: "rest" }, 48)).toEqual({ below: false, above: false });
  });

  it("shows the pending choice apart from what the text plays", () => {
    const keys = pickerKeys(keyboard({ kind: "note", note: "c3" }, { pending: { kind: "note", note: "e3" } }));
    expect(keys.find((key) => key.name === "c3")).toMatchObject({ isPressed: true, isPending: false });
    expect(keys.find((key) => key.name === "e3")).toMatchObject({ isPressed: false, isPending: true, isDimmed: true });
    expect(scaleWarning(keys.find((key) => key.isPending), "c minor")).toBe(
      "c minor moves this note to the scale; turn off Scale lock to play it",
    );
  });
});

describe("the keyboard", () => {
  it("shows two octaves from a C, black keys after the right white key", () => {
    const keys = pickerKeys(keyboard({ kind: "rest" }));
    expect(keys).toHaveLength(24);
    expect(keys[3]).toMatchObject({ name: "eb3", isBlack: true, isInScale: true, whiteBefore: 2 });
    expect(keys.filter((key) => !key.isBlack)).toHaveLength(14);
    expect(pickerKeys(keyboard({ kind: "rest" }, { isScaleLocked: false }))[4]?.isDimmed).toBe(false);
  });

  it("opens on the octave of the note and moves an octave at a time inside the range", () => {
    expect(windowStartFor(63, FULL)).toBe(60);
    expect(windowStartFor(5, FULL)).toBe(12);
    expect(windowStartFor(100, FULL)).toBe(72);
    expect(shiftWindow(60, 1, FULL)).toBe(72);
    expect(shiftWindow(72, 1, FULL)).toBeNull();
    expect(shiftWindow(12, -1, FULL)).toBeNull();
    expect(octaveShifted({ kind: "note", note: "eb2" }, 1)).toEqual({ kind: "note", note: "eb3" });
    expect(octaveShifted({ kind: "chord", root: "C", quality: "m" }, 1)).toBeNull();
  });

  it("reads keys aloud by name", () => {
    expect(spokenNote("c#2", false)).toBe("C sharp 2");
    expect(spokenNote("g4", true)).toBe("G 4, in chord");
  });
});

describe("what a step plays", () => {
  it("reads notes, chords with their quality, holds and rests", () => {
    expect(stepPitchOf(note("eb2"))).toEqual({ kind: "note", note: "eb2" });
    expect(stepPitchOf({ kind: "chord", label: "Cm7" })).toEqual({ kind: "chord", root: "C", quality: "m7" });
    expect(stepPitchOf({ kind: "chord", label: "Bb" })).toEqual({ kind: "chord", root: "Bb", quality: "major" });
    expect(stepPitchOf(hold)).toEqual({ kind: "hold" });
    expect(stepPitchOf(rest)).toEqual({ kind: "rest" });
  });

  it("writes labels and chord roots the way the text does", () => {
    expect(pitchLabel({ kind: "chord", root: "F", quality: "m7" })).toBe("Fm7");
    expect(pitchLabel({ kind: "chord", root: "F", quality: "major" })).toBe("F");
    expect(chordRootOf(63)).toBe("Eb");
    expect(midiOfPitch({ kind: "chord", root: "F", quality: "m" })).toBe(53);
    expect(midiOfPitch({ kind: "rest" })).toBeNull();
  });

  it("opens a rest or hold on the last note used before it", () => {
    const bar = [note("c2"), hold, note("g2"), rest, rest];
    expect(startingMidi(bar, 4, 0)).toBe(43);
    expect(startingMidi([rest, note("eb2")], 0, 0)).toBe(39);
    expect(startingMidi([rest, rest], 1, 3)).toBe(39);
  });

  it("offers every chord quality on the chosen root", () => {
    const chips = qualityChips("F", "m7");
    expect(chips.map((chip) => chip.label)).toEqual(["F", "Fm", "F7", "Fm7", "Fmaj7", "Fsus2", "Fsus4", "Fdim"]);
    expect(chips.filter((chip) => chip.isPressed).map((chip) => chip.quality)).toEqual(["m7"]);
  });
});
describe("pickOutcome", () => {
  it("writes on a second tap of the pitch already chosen", () => {
    expect(pickOutcome({ kind: "note", note: "eb4" }, { kind: "note", note: "eb4" })).toBe("commit");
  });
  it("chooses and sounds a first tap or another pitch", () => {
    expect(pickOutcome(null, { kind: "note", note: "eb4" })).toBe("audition");
    expect(pickOutcome({ kind: "note", note: "eb4" }, { kind: "note", note: "f4" })).toBe("audition");
  });
});
