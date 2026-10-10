// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { viewFixture } from "../../testing/view-fixture";
import { lengthChoice, lengthChoiceText, type LengthIntents } from "./length-choices";

function recorder(): { readonly calls: string[]; readonly intents: LengthIntents } {
  const calls: string[] = [];
  return {
    calls,
    intents: {
      setLoopBars: (bars) => calls.push(`loop ${bars}`),
      setBars: (track, bars) => calls.push(`${track} ${bars}`),
      setPartBars: (part, bars) => calls.push(`part ${part} ${bars}`),
    },
  };
}

describe("lengthChoice", () => {
  const view = viewFixture();
  it("writes the length of the chip that opened it, then closes", () => {
    const { calls, intents } = recorder();
    const onPicked = (): number => calls.push("closed");
    lengthChoice(view, { target: "loop", track: null, part: null }, intents, onPicked)?.pick(8);
    lengthChoice(view, { target: "pattern", track: null, part: null }, intents, onPicked)?.pick(2);
    lengthChoice(view, { target: "part", track: null, part: 2 }, intents, onPicked)?.pick(16);
    expect(calls).toEqual(["loop 8", "closed", "kick 2", "closed", "part 2 16", "closed"]);
  });
  it("offers nothing when the part is gone", () => {
    const { calls, intents } = recorder();
    expect(lengthChoice(view, { target: "part", track: null, part: 9 }, intents, () => calls.push("closed"))).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe("lengthChoiceText", () => {
  const view = viewFixture();

  it("chooses the loop, with its note", () => {
    expect(lengthChoiceText(view, { target: "loop", track: null, part: null })).toEqual({
      title: "Loop length",
      current: 4,
      written: null,
      note: "Changes on the next bar. The music keeps playing.",
      other: "Other length: 3, 5, 6… in the Code panel (loop 6).",
    });
  });

  it("chooses the pattern of the track shown, the first track by default", () => {
    expect(lengthChoiceText(view, { target: "pattern", track: null, part: null })).toMatchObject({ title: "Pattern length · kick", current: 4 });
    expect(lengthChoiceText(view, { target: "pattern", track: "bass", part: null })).toMatchObject({ current: 1 });
  });

  it("says what an odd length written in the code is, since none of the five lights up", () => {
    expect(lengthChoiceText(viewFixture({ loopBars: 6 }), { target: "loop", track: null, part: null })).toMatchObject({
      current: 6,
      written: "Now 6 bars, set in the code",
    });
    expect(lengthChoiceText(view, { target: "part", track: null, part: 2 })).toMatchObject({ written: "Now 32 bars, set in the code" });
    expect(lengthChoiceText(view, { target: "pattern", track: "bass", part: null })).toMatchObject({ written: null });
  });

  it("chooses a part, and gives up when the track or part is gone", () => {
    expect(lengthChoiceText(view, { target: "part", track: null, part: 2 })).toMatchObject({ title: "Part length · drop", current: 32 });
    expect(lengthChoiceText(view, { target: "part", track: null, part: 9 })).toBeNull();
    expect(lengthChoiceText(view, { target: "pattern", track: "clap", part: null })).toBeNull();
  });
});
