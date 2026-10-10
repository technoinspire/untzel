// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { track } from "../../testing/view-fixture";
import { trackRowState } from "./track-table-row";
describe("trackRowState", () => {
  const bass = { ...track("bass", "pitched"), instrument: "acid bass" };
  it("numbers the row from 1 and names the track with its instrument", () => {
    const state = trackRowState(bass, 2, null);
    expect(state.index).toBe("3");
    expect(state.name).toBe("bass, acid bass");
    expect(state.isSelected).toBe(false);
  });
  it("marks the selected track", () => {
    expect(trackRowState(bass, 0, "bass").isSelected).toBe(true);
  });
  it("presses the pattern while it plays or waits for the next bar", () => {
    expect(trackRowState({ ...bass, playState: "on" }, 0, null).isPatternPressed).toBe(true);
    expect(trackRowState({ ...bass, playState: "queued" }, 0, null).isPatternPressed).toBe(true);
    expect(trackRowState({ ...bass, playState: "off" }, 0, null).isPatternPressed).toBe(false);
  });
  it("puts the tone on a 0 to 1000 thumb and speaks its value", () => {
    const state = trackRowState({ ...bass, tone: 0.4567, toneSetBy: [] }, 0, null);
    expect(state).toMatchObject({ toneValue: "457", isToneSetBy: false, setBy: "", toneValueText: "0.46" });
  });
  it("makes the tone inert and says which parameter sets it", () => {
    const state = trackRowState({ ...bass, toneSetBy: [{ parameter: "cutoff", isSignal: false }] }, 0, null);
    expect(state).toMatchObject({ isToneSetBy: true, setBy: "Set by cutoff", toneValueText: "Set by cutoff" });
  });
});
