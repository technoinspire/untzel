// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { measureLoudness } from "./loudness";

function sine(frequency: number, peak: number, seconds: number, sampleRate: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let n = 0; n < out.length; n += 1) out[n] = peak * Math.sin((2 * Math.PI * frequency * n) / sampleRate);
  return out;
}

describe("BS.1770-4 loudness", () => {
  for (const sampleRate of [44_100, 48_000]) {
    it(`reads a 1 kHz sine at −20 dBFS in one channel as −23.0 LUFS at ${sampleRate} Hz`, () => {
      const tone = sine(1000, 0.1, 10, sampleRate);
      const { integratedLufs, shortTermMaxLufs } = measureLoudness([tone], sampleRate);
      expect(Math.abs(integratedLufs + 23)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(shortTermMaxLufs + 23)).toBeLessThanOrEqual(0.1);
    });
  }

  it("adds 3 dB when the same signal is in both channels", () => {
    const tone = sine(1000, 0.1, 5, 48_000);
    const { integratedLufs } = measureLoudness([tone, tone], 48_000);
    expect(Math.abs(integratedLufs + 20)).toBeLessThanOrEqual(0.1);
  });

  it("gates silence out and reads pure silence as −Infinity", () => {
    const sampleRate = 48_000;
    const tone = sine(1000, 0.1, 5, sampleRate);
    const withSilence = new Float32Array(tone.length * 2);
    withSilence.set(tone);
    // Ungated, half silence would read −26 LUFS. Gated, only the blocks that straddle
    // the end of the tone (above the −33 LUFS relative gate) pull it a little down.
    const gated = measureLoudness([withSilence], sampleRate).integratedLufs;
    expect(gated).toBeGreaterThan(-23.3);
    expect(gated).toBeLessThanOrEqual(-23);
    expect(measureLoudness([new Float32Array(sampleRate)], sampleRate).integratedLufs).toBe(-Infinity);
  });
});
