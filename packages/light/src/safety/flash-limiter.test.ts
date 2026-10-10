// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { FlashLimiter, contrastRatio, isSaturatedRed, relativeLuminance, type FrameLuminance } from "./flash-limiter";

const FPS = 60;
const THRESHOLD = 0.1;

/** Square pulses of full-screen light: `rate` peaks per second, each `onFrames` long. */
function pulses(rate: number, seconds: number, peak: number, isSaturatedRed = false): FrameLuminance[] {
  const frames: FrameLuminance[] = [];
  const period = Math.round(FPS / rate);
  for (let frame = 0; frame < seconds * FPS; frame += 1) {
    const on = frame % period < Math.max(1, Math.floor(period / 3));
    frames.push({ time: frame / FPS, base: 0, transient: on ? peak : 0, isSaturatedRed });
  }
  return frames;
}

/** Counts WCAG flashes in the output: a rise of ≥ threshold then a fall of ≥ threshold. */
function flashTimes(output: readonly { time: number; light: number }[]): number[] {
  const times: number[] = [];
  let trough = output[0]?.light ?? 0;
  let peak = 0;
  let isHigh = false;
  let riseAt = 0;
  for (const { time, light } of output) {
    if (!isHigh) {
      trough = Math.min(trough, light);
      if (light - trough >= THRESHOLD - 1e-9) {
        isHigh = true;
        peak = light;
        riseAt = time;
      }
    } else {
      peak = Math.max(peak, light);
      if (peak - light >= THRESHOLD - 1e-9) {
        times.push(riseAt);
        isHigh = false;
        trough = light;
      }
    }
  }
  return times;
}

function run(limiter: FlashLimiter, frames: readonly FrameLuminance[]): { time: number; light: number }[] {
  return frames.map((frame) => ({ time: frame.time, light: frame.base + frame.transient * limiter.gain(frame) }));
}

function maxInAnySecond(times: readonly number[]): number {
  return times.reduce((max, start) => Math.max(max, times.filter((time) => time >= start && time < start + 1).length), 0);
}

describe("FlashLimiter", () => {
  it("lets three full-screen peaks per second through untouched", () => {
    const limiter = new FlashLimiter();
    const frames = pulses(3, 4, 0.6);
    const output = run(limiter, frames);
    expect(maxInAnySecond(flashTimes(output))).toBe(3);
    expect(Math.max(...output.map((frame) => frame.light))).toBeCloseTo(0.6);
  });

  it.each([4, 8.8, 15, 30])("never lets more than 3 peaks per second through at %s peaks/s", (rate) => {
    const limiter = new FlashLimiter();
    const output = run(limiter, pulses(rate, 5, 0.8));
    expect(maxInAnySecond(flashTimes(output))).toBeLessThanOrEqual(3);
  });

  it("holds a refused peak under the flash threshold", () => {
    const limiter = new FlashLimiter();
    const gains = pulses(10, 1, 0.5).map((frame) => ({ frame, gain: limiter.gain(frame) }));
    const refused = gains.filter(({ frame, gain }) => frame.transient > 0 && gain < 1);
    expect(refused.length).toBeGreaterThan(0);
    for (const { frame, gain } of refused) expect(frame.transient * gain).toBeLessThan(THRESHOLD);
  });

  it("never passes a large saturated red flash", () => {
    const limiter = new FlashLimiter();
    const output = run(limiter, pulses(1, 3, 0.7, true));
    expect(flashTimes(output)).toHaveLength(0);
    expect(Math.max(...output.map((frame) => frame.light))).toBeLessThan(THRESHOLD);
  });

  it("with reduced motion turns every peak into slow light, with no flash", () => {
    const limiter = new FlashLimiter({ reducedMotion: true });
    const output = run(limiter, pulses(2.2, 4, 1));
    expect(flashTimes(output)).toHaveLength(0);
    expect(Math.max(...output.map((frame) => frame.light))).toBeLessThanOrEqual(THRESHOLD / 2);
    for (let index = 1; index < output.length; index += 1) {
      const rise = (output[index]?.light ?? 0) - (output[index - 1]?.light ?? 0);
      expect(rise).toBeLessThanOrEqual(0.1 / FPS + 1e-9);
    }
  });

  it("small, sub-threshold changes (hats, sparks) are never attenuated", () => {
    const limiter = new FlashLimiter();
    for (const frame of pulses(8.8, 2, 0.05)) expect(limiter.gain(frame)).toBe(1);
  });

  it("frees the quota after one second", () => {
    const limiter = new FlashLimiter();
    run(limiter, pulses(10, 1, 0.8));
    expect(limiter.recentFlashes(0.99)).toBe(3);
    expect(limiter.recentFlashes(2.5)).toBe(0);
  });
});

describe("colour helpers", () => {
  it("matches the WCAG contrasts of the stage colours", () => {
    const stage = relativeLuminance(11, 11, 12);
    const flare = relativeLuminance(246, 93, 0);
    expect(contrastRatio(relativeLuminance(255, 255, 255), stage)).toBeCloseTo(19.67, 1);
    expect(contrastRatio(flare, stage)).toBeCloseTo(6.07, 1);
  });

  it("flags saturated red, not flare orange", () => {
    expect(isSaturatedRed(255, 0, 0)).toBe(true);
    expect(isSaturatedRed(197, 45, 31)).toBe(false);
    expect(isSaturatedRed(246, 93, 0)).toBe(false);
  });
});

describe("FlashLimiter.setReducedMotion (the menu's switch)", () => {
  const DT = 1 / FPS;
  const frame = (index: number, transient: number): FrameLuminance => ({ time: index * DT, base: 0, transient, isSaturatedRed: false });
  it("(a) to reduced: the first reduced frame differs from the last full one by at most the slew", () => {
    const limiter = new FlashLimiter();
    let last = 0;
    for (let index = 0; index < 30; index += 1) last = 0.3 * limiter.gain(frame(index, 0.3));
    limiter.setReducedMotion(true);
    const first = 0.3 * limiter.gain(frame(30, 0.3));
    expect(Math.abs(first - last)).toBeLessThanOrEqual(0.1 * DT + 1e-9);
  });
  it("(b) to full: a rise of the threshold or more from what was on screen counts as a flash", () => {
    const limiter = new FlashLimiter({ reducedMotion: true });
    for (let index = 0; index < 30; index += 1) limiter.gain(frame(index, 0.02));
    limiter.setReducedMotion(false);
    const before = limiter.recentFlashes(30 * DT);
    expect(limiter.gain(frame(30, 0.5))).toBe(1);
    expect(limiter.recentFlashes(30 * DT)).toBe(before + 1);
  });
  it("(c) the flashes of the last second still count across a switch and back", () => {
    const limiter = new FlashLimiter();
    let index = 0;
    for (let flash = 0; flash < 3; flash += 1) {
      limiter.gain(frame(index++, 0.5));
      limiter.gain(frame(index++, 0));
    }
    limiter.setReducedMotion(true);
    limiter.gain(frame(index++, 0));
    limiter.setReducedMotion(false);
    const output = 0.5 * limiter.gain(frame(index, 0.5));
    expect(output).toBeLessThan(0 + THRESHOLD);
  });
  it("(d) with Off, ten flashes a second are still held to three", () => {
    const limiter = new FlashLimiter({ reducedMotion: true });
    limiter.setReducedMotion(false);
    const output = pulses(10, 1, 0.5).map((entry) => ({ time: entry.time, light: entry.transient * limiter.gain(entry) }));
    expect(flashTimes(output).length).toBeLessThanOrEqual(3);
  });
  it("(e) switching to the current value changes nothing", () => {
    const plain = new FlashLimiter();
    const switched = new FlashLimiter();
    switched.setReducedMotion(false);
    for (const entry of pulses(5, 1, 0.4)) expect(switched.gain(entry)).toBe(plain.gain(entry));
  });
});
