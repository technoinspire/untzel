// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import {
  amplitudeEnvelope,
  dctKeep,
  envelopeRatio,
  extractFeatures,
  fftInPlace,
  harmonicToNoiseDb,
  hannWindow,
  isPowerOfTwo,
  melFilterBank,
  mfccDistance,
  powerSpectrum,
} from "./timbre";

const SAMPLE_RATE = 48_000;

/** A pure sine of `hz` for `seconds`, used as a known fixture. */
function sine(hz: number, seconds: number, amplitude = 0.9): Float32Array {
  const length = Math.round(seconds * SAMPLE_RATE);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) samples[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE);
  return samples;
}

/** Deterministic white noise (a seeded LCG) for the flatness and HNR checks. */
function noise(seconds: number, amplitude = 0.5): Float32Array {
  const length = Math.round(seconds * SAMPLE_RATE);
  const samples = new Float32Array(length);
  let state = 0x12345678;
  for (let i = 0; i < length; i += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    samples[i] = amplitude * ((state / 0x3fffffff) - 1);
  }
  return samples;
}

describe("FFT", () => {
  it("recognizes powers of two", () => {
    expect(isPowerOfTwo(1024)).toBe(true);
    expect(isPowerOfTwo(2048)).toBe(true);
    expect(isPowerOfTwo(1000)).toBe(false);
    expect(isPowerOfTwo(0)).toBe(false);
  });

  it("rejects non-power-of-two or mismatched lengths", () => {
    expect(() => fftInPlace(new Float64Array(3), new Float64Array(3))).toThrow(/power-of-two/);
    expect(() => fftInPlace(new Float64Array(4), new Float64Array(8))).toThrow();
  });

  it("puts a cosine's energy in one bin", () => {
    const size = 64;
    const bin = 4;
    const real = new Float64Array(size);
    const imag = new Float64Array(size);
    for (let i = 0; i < size; i += 1) real[i] = Math.cos((2 * Math.PI * bin * i) / size);
    fftInPlace(real, imag);
    const magnitude = (k: number) => Math.hypot(real[k]!, imag[k]!);
    expect(magnitude(bin)).toBeGreaterThan(size / 2 - 1);
    expect(magnitude(bin + 1)).toBeLessThan(1e-6);
    expect(magnitude(1)).toBeLessThan(1e-6);
  });

  it("peaks the power spectrum at the sine's bin", () => {
    const fftSize = 2048;
    const binHz = SAMPLE_RATE / fftSize;
    const targetBin = 40;
    const frame = new Float64Array(fftSize);
    const window = hannWindow(fftSize);
    for (let i = 0; i < fftSize; i += 1) {
      frame[i] = Math.sin((2 * Math.PI * targetBin * binHz * i) / SAMPLE_RATE) * window[i]!;
    }
    const power = powerSpectrum(frame, fftSize);
    let argmax = 0;
    for (let bin = 0; bin < power.length; bin += 1) if (power[bin]! > power[argmax]!) argmax = bin;
    expect(argmax).toBe(targetBin);
  });
});

describe("Hann window", () => {
  it("is zero at the edges and one at the center", () => {
    const window = hannWindow(1024);
    expect(window[0]).toBeCloseTo(0, 6);
    expect(window[512]).toBeCloseTo(1, 6);
  });
});

describe("DCT", () => {
  it("drops c0 and keeps c1..cN", () => {
    const input = [1, 2, 3, 4];
    const kept = dctKeep(input, 3);
    expect(kept).toHaveLength(3);
    // c0 (the mean term) is intentionally absent, so a DC-only signal gives ~0 coefficients.
    const dc = dctKeep([5, 5, 5, 5], 3);
    for (const value of dc) expect(Math.abs(value)).toBeLessThan(1e-9);
  });
});

describe("mel filter bank", () => {
  it("builds the requested number of filters over the half spectrum", () => {
    const filters = melFilterBank(40, 2048, SAMPLE_RATE);
    expect(filters).toHaveLength(40);
    for (const filter of filters) expect(filter.length).toBe(2048 / 2 + 1);
  });
});

describe("amplitude envelope", () => {
  it("follows a decaying tone down", () => {
    const length = SAMPLE_RATE;
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      samples[i] = Math.exp(-3 * (i / SAMPLE_RATE)) * Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE);
    }
    const envelope = amplitudeEnvelope(samples, SAMPLE_RATE);
    expect(envelope[0]!).toBeGreaterThan(envelope[envelope.length - 1]!);
  });
});

describe("harmonic-to-noise ratio", () => {
  it("is high for a sine and low for noise", () => {
    const toneHnr = harmonicToNoiseDb(sine(220, 0.3), SAMPLE_RATE);
    const noiseHnr = harmonicToNoiseDb(noise(0.3), SAMPLE_RATE);
    expect(toneHnr).toBeGreaterThan(noiseHnr);
    // The 40 ms window is not a whole number of periods, so a clean sine measures ~9 dB,
    // not the +Inf of a perfect period; the point is that it clears noise with margin.
    expect(toneHnr).toBeGreaterThan(5);
    expect(toneHnr - noiseHnr).toBeGreaterThan(3);
  });
});

describe("extractFeatures", () => {
  it("places a sine's centroid near its frequency and reads a low flatness", () => {
    const features = extractFeatures(sine(1000, 0.5), { sampleRate: SAMPLE_RATE });
    expect(features.centroidHz).toBeGreaterThan(850);
    expect(features.centroidHz).toBeLessThan(1150);
    expect(features.flatness).toBeLessThan(0.05);
    expect(features.mfcc).toHaveLength(13);
  });

  it("reads a high flatness for white noise", () => {
    const features = extractFeatures(noise(0.5), { sampleRate: SAMPLE_RATE });
    expect(features.flatness).toBeGreaterThan(0.2);
  });

  it("rejects a non-power-of-two fftSize", () => {
    expect(() => extractFeatures(sine(440, 0.1), { sampleRate: SAMPLE_RATE, fftSize: 1000 })).toThrow(/power of two/);
  });
});

describe("mfccDistance", () => {
  it("is zero for identical vectors and symmetric", () => {
    const a = [1, 2, 3, 4];
    const b = [1, 5, 3, 1];
    expect(mfccDistance(a, a)).toBe(0);
    expect(mfccDistance(a, b)).toBeCloseTo(mfccDistance(b, a), 12);
    expect(mfccDistance(a, b)).toBeCloseTo(Math.hypot(3, 3), 12);
  });

  it("separates a sine from noise by more than a whole-tone shift of the sine", () => {
    const a = extractFeatures(sine(220, 0.5), { sampleRate: SAMPLE_RATE }).mfcc;
    const wholeTone = extractFeatures(sine(220 * 2 ** (2 / 12), 0.5), { sampleRate: SAMPLE_RATE }).mfcc;
    const noiseMfcc = extractFeatures(noise(0.5), { sampleRate: SAMPLE_RATE }).mfcc;
    expect(mfccDistance(a, noiseMfcc)).toBeGreaterThan(mfccDistance(a, wholeTone));
  });

  it("rejects mismatched lengths", () => {
    expect(() => mfccDistance([1, 2], [1, 2, 3])).toThrow(/length/);
  });
});

describe("envelopeRatio", () => {
  it("is always at least one and symmetric", () => {
    expect(envelopeRatio(0.2, 0.4)).toBeCloseTo(2, 12);
    expect(envelopeRatio(0.4, 0.2)).toBeCloseTo(2, 12);
    expect(envelopeRatio(0, 0)).toBe(1);
    expect(envelopeRatio(0, 0.5)).toBe(Infinity);
  });
});
