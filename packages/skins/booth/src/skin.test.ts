// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { cpuLabel, inSongLabel, lengthChipLabel, loopLengthLabel, tileCaption } from "./behavior/text/format";
import { miniSteps } from "./views/pattern/mini-steps";
import type { StepView } from "@untzel/presentation/view-model";
import { DRAG_SLOP_PX, TONE_RANGE_PX, TileGesture } from "./behavior/gestures/tile-gesture";

const hit: StepView = { kind: "hit", label: null };
const rest: StepView = { kind: "rest", label: null };
const hold: StepView = { kind: "hold", label: null };

describe("miniSteps", () => {
  it("shows 16 steps as they are", () => {
    const steps = [hit, rest, rest, rest, hit, rest, rest, rest, hit, rest, rest, rest, hit, rest, rest, rest];
    expect(miniSteps(steps).filter((cell) => cell === "hit")).toHaveLength(4);
  });

  it("spreads 8 steps over 16 slots by time", () => {
    const cells = miniSteps([hit, rest, rest, hit, rest, rest, hit, rest]);
    expect(cells).toHaveLength(16);
    expect([0, 6, 12].map((slot) => cells[slot])).toEqual(["hit", "hit", "hit"]);
    expect(cells[1]).toBe("rest");
  });

  it("folds 32 steps into 16 slots, a hit wins", () => {
    const steps = Array.from({ length: 32 }, (_, index) => (index % 4 === 1 ? hit : rest));
    expect(miniSteps(steps).filter((cell) => cell === "hit")).toHaveLength(8);
  });

  it("keeps a held note as a line", () => {
    expect(miniSteps([hit, hold, hold, hold])).toEqual([
      "hit", "rest", "rest", "rest", "hold", "hold", "hold", "hold", "hold", "hold", "hold", "hold", "hold", "hold", "hold", "hold",
    ]);
  });
});

describe("format", () => {
  it("writes the transport labels as the screens show them", () => {
    expect(lengthChipLabel(4)).toBe("Length 4 bars");
    expect(lengthChipLabel(1)).toBe("Length 1 bar");
    expect(loopLengthLabel(1)).toBe("Loop length 1 bar");
    expect(loopLengthLabel(16)).toBe("Loop length 16 bars");
  });

  it("writes tile captions per state", () => {
    expect(tileCaption("hat", "on", null)).toBe("hat");
    expect(tileCaption("hat", "off", null)).toBe("hat · off");
    expect(tileCaption("acid", "queued", null)).toBe("next bar");
    expect(tileCaption("acid", "not-in-section", "intro")).toBe("not in intro");
  });

  it("writes library counts and CPU", () => {
    expect(inSongLabel(0)).toBe("new");
    expect(inSongLabel(2)).toBe("2 in song");
    expect(cpuLabel(0.344)).toBe("CPU 34%");
  });
});

describe("TileGesture", () => {
  it("a tap toggles", () => {
    const gesture = new TileGesture();
    gesture.down(100, 0.5);
    expect(gesture.up()).toEqual({ kind: "toggle" });
  });

  it("a vertical drag moves tone, up is more", () => {
    const gesture = new TileGesture();
    gesture.down(100, 0.5);
    expect(gesture.move(100 - DRAG_SLOP_PX / 2)).toEqual({ kind: "none" });
    expect(gesture.move(100 - TONE_RANGE_PX / 4)).toEqual({ kind: "tone", tone: 0.75 });
    expect(gesture.move(100 + TONE_RANGE_PX)).toEqual({ kind: "tone", tone: 0 });
    expect(gesture.up()).toEqual({ kind: "none" });
  });

  it("holding solos while held", () => {
    const gesture = new TileGesture();
    gesture.down(0, 0);
    expect(gesture.hold()).toEqual({ kind: "solo", isSoloed: true });
    expect(gesture.up()).toEqual({ kind: "solo", isSoloed: false });
  });

  it("a hold after a drag started does nothing", () => {
    const gesture = new TileGesture();
    gesture.down(0, 0);
    gesture.move(40);
    expect(gesture.hold()).toEqual({ kind: "none" });
  });
});
