// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { HeldClock } from "./held-clock";
import { WorkletClock } from "./worklet-clock";

const SR = 48_000;

function clocks() {
  let now = 0;
  const inner = new WorkletClock(SR, () => now);
  return { inner, held: new HeldClock(inner), advance: (ms: number) => (now += ms) };
}

describe("HeldClock", () => {
  it("is null before the first report, like the inner clock", () => {
    const { held } = clocks();
    expect(held.hold()).toBeNull();
    expect(held.nowFrame()).toBeNull();
    held.release();
    expect(held.staleness()).toBe(Number.POSITIVE_INFINITY);
    expect(held.sampleRate).toBe(SR);
  });
  it("returns the same frame for every read inside one hold", () => {
    const { inner, held, advance } = clocks();
    inner.report(1024);
    const frame = held.hold();
    advance(0.1);
    expect(held.nowFrame()).toBe(frame);
    advance(5);
    expect(held.nowFrame()).toBe(frame);
    held.release();
    expect(held.nowFrame()).toBe(1024 + 245);
  });
  it("never descends when a late report moves the inner clock back", () => {
    const { inner, held, advance } = clocks();
    inner.report(1024);
    inner.report(2048); // two reports at the same receivedAt
    advance(30);
    const before = held.hold() ?? 0;
    held.release();
    inner.report(2048 + 1024); // late: the inner clock now reads less than it did
    expect(inner.nowFrame()).toBeLessThan(before);
    expect(held.hold()).toBe(before);
    held.release();
    expect(held.nowFrame()).toBe(before);
    advance(30);
    expect(held.nowFrame()).toBe(2048 + 1024 + 1440);
  });
  it("never descends under an audio callback that renders 2 048 frames at once", () => {
    const { inner, held, advance } = clocks();
    const callbackMs = (2048 / SR) * 1000;
    let descents = 0;
    let lastInner = -1;
    let lastHeld = -1;
    for (let callback = 0; callback < 50; callback += 1) {
      // Each callback renders 16 quanta back to back: two reports arrive together, and a
      // message handled between them reads the first, about 1 000 frames behind.
      inner.report(callback * 2048 + 1024);
      const between = inner.nowFrame() ?? 0;
      if (between < lastInner) descents += 1;
      expect(held.hold()).toBeGreaterThanOrEqual(lastHeld);
      held.release();
      inner.report(callback * 2048 + 2048);
      for (let step = 0; step < 8; step += 1) {
        const innerFrame = inner.nowFrame() ?? 0;
        if (innerFrame < lastInner) descents += 1;
        lastInner = innerFrame;
        const frame = (step % 2 === 0 ? held.hold() : held.nowFrame()) ?? 0;
        held.release();
        expect(frame).toBeGreaterThanOrEqual(lastHeld);
        expect(frame).toBeGreaterThanOrEqual(innerFrame);
        lastHeld = frame;
        advance(callbackMs / 8);
      }
    }
    expect(descents).toBeGreaterThan(0);
  });
  it("starts without a floor on a fresh instance", () => {
    const first = clocks();
    first.inner.report(96_000);
    expect(first.held.nowFrame()).toBe(96_000);
    const second = clocks();
    second.inner.report(1024);
    expect(second.held.nowFrame()).toBe(1024);
  });
});
