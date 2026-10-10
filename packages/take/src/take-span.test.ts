// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { Take, TakeEntry } from "./take";
import { takeSpan } from "./take-span";

const SR = 44_100;
const PLAY: TakeEntry = { command: { kind: "play", mode: "loop", startBar: null }, frame: 1_000, horizon: null, startFrame: 6_400 };

function take(endFrame: number, entries: readonly TakeEntry[] = [PLAY]): Take {
  return { format: "untzel-take", version: 1, sampleRate: SR, armFrame: 900, endFrame, endedBy: "stop", entries, instruments: [], title: null };
}

describe("takeSpan", () => {
  it("runs from t0 to the end with firstSound, the default", () => {
    expect(takeSpan(take(6_400 + 2 * SR))).toEqual({ startFrame: 6_400, endFrame: 6_400 + 2 * SR, seconds: 2 });
    expect(takeSpan(take(6_400 + 2 * SR), "firstSound")?.startFrame).toBe(6_400);
  });
  it("runs from the arm to the end with arm", () => {
    expect(takeSpan(take(900 + SR), "arm")).toEqual({ startFrame: 900, endFrame: 900 + SR, seconds: 1 });
  });
  it("is null without t0 for firstSound, and not for arm", () => {
    const stopped: TakeEntry = { command: { kind: "play", mode: "loop", startBar: null }, frame: 1_000, horizon: null };
    expect(takeSpan(take(900 + 5 * SR, [stopped]))).toBeNull();
    expect(takeSpan(take(900 + 5 * SR, [stopped]), "arm")?.seconds).toBe(5);
  });
  it("is null under MIN_TAKE_SECONDS from each origin", () => {
    expect(takeSpan(take(6_400 + SR - 1))).toBeNull();
    expect(takeSpan(take(6_400 + SR))).not.toBeNull();
    expect(takeSpan(take(900 + SR - 1), "arm")).toBeNull();
  });
});
