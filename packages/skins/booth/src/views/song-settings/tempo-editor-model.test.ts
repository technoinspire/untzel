// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { fieldKeySteps, parseTempo, steppedTempo, tapTempo, tempoEditorModel, type TapState } from "./tempo-editor-model";

describe("tempoEditorModel", () => {
  it("edits the song's tempo when no part has its own", () => {
    expect(tempoEditorModel({ sounding: 124, songTempo: 124, setBy: null })).toEqual({
      title: "Tempo",
      field: "124",
      link: null,
      buttonLabel: "Tempo, 124 BPM",
      note: "Now 124 BPM. A new tempo starts on the next bar.",
    });
  });

  it("is Song tempo under a part's own | tempo, and the button says what sounds", () => {
    const model = tempoEditorModel({ sounding: 128, songTempo: 124, setBy: "drop" });
    expect(model.title).toBe("Song tempo");
    expect(model.field).toBe("124");
    expect(model.link).toBe("drop plays at 128, set in its section line. Change it in the Code panel.");
    expect(model.buttonLabel).toBe("Tempo, 128 BPM, song tempo 124");
  });

  it("shows one decimal when the text has it", () => {
    expect(tempoEditorModel({ sounding: 132.5, songTempo: 132.5, setBy: null }).field).toBe("132.5");
  });
});

describe("parseTempo", () => {
  it("accepts 40 to 300 with one decimal, a comma as a point", () => {
    expect(parseTempo("128", 124)).toEqual({ kind: "ok", bpm: 128 });
    expect(parseTempo("132,5", 124)).toEqual({ kind: "ok", bpm: 132.5 });
    expect(parseTempo(" 40 ", 124)).toEqual({ kind: "ok", bpm: 40 });
  });

  it("refuses outside the range or not a number, and nothing is written", () => {
    const error = { kind: "error", message: "Tempo runs from 40 to 300 BPM. 124 keeps playing." };
    expect(parseTempo("320", 124)).toEqual(error);
    expect(parseTempo("39.9", 124)).toEqual(error);
    expect(parseTempo("fast", 124)).toEqual(error);
    expect(parseTempo("128.25", 124)).toEqual(error);
  });

  it("an empty field or the same tempo changes nothing", () => {
    expect(parseTempo("", 124)).toEqual({ kind: "unchanged" });
    expect(parseTempo("124", 124)).toEqual({ kind: "unchanged" });
  });
});

describe("tempo steps and tap tempo", () => {
  it("moves 1 BPM, or 10, inside the range", () => {
    expect(steppedTempo(124, 1)).toBe(125);
    expect(steppedTempo(124, -10)).toBe(114);
    expect(steppedTempo(299, 10)).toBe(300);
    expect(steppedTempo(132.5, 1)).toBe(134);
  });

  it("gives the tempo from the fourth tap, the average of the last three intervals", () => {
    let state: TapState = { taps: [], bpm: null };
    for (const at of [0, 500, 1000]) state = tapTempo(state, at);
    expect(state.bpm).toBeNull();
    state = tapTempo(state, 1500);
    expect(state.bpm).toBe(120);
    state = tapTempo(state, 1990);
    expect(state.taps).toHaveLength(4);
    expect(state.bpm).toBe(experimentalBpm([500, 1000, 1500, 1990]));
  });

  it("starts over after a pause of 2 s", () => {
    let state: TapState = { taps: [0, 500, 1000, 1500], bpm: 120 };
    state = tapTempo(state, 4000);
    expect(state).toEqual({ taps: [4000], bpm: null });
  });
});

function experimentalBpm(taps: readonly number[]): number {
  return Math.round(60_000 / (((taps.at(-1) ?? 0) - (taps[0] ?? 0)) / 3));
}
describe("fieldKeySteps", () => {
  it("steps 1 BPM with the arrows and 10 with Shift", () => {
    expect(fieldKeySteps("ArrowUp", false)).toBe(1);
    expect(fieldKeySteps("ArrowDown", false)).toBe(-1);
    expect(fieldKeySteps("ArrowUp", true)).toBe(10);
    expect(fieldKeySteps("ArrowDown", true)).toBe(-10);
  });
  it("leaves the other keys to the field", () => {
    expect(fieldKeySteps("Enter", false)).toBeNull();
    expect(fieldKeySteps("ArrowLeft", true)).toBeNull();
  });
});
