// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { addableEffects, effectLabel, removeEffectLabel, soundButtonLabel } from "./sound-labels";

describe("sound group labels", () => {
  it("names effects for people and offers only the ones the track lacks, in chain order", () => {
    expect(effectLabel("crush")).toBe("Bitcrush");
    expect(removeEffectLabel("lowpass")).toBe("Remove low-pass");
    expect(addableEffects([{ effect: "chorus", parameters: [] }, { effect: "lowpass", parameters: [] }])).toEqual(["highpass", "distort", "crush", "phaser", "eq", "comp", "gate"]);
  });

  it("labels the sound button", () => {
    expect(soundButtonLabel("bright")).toBe("Sound bright");
  });
});
