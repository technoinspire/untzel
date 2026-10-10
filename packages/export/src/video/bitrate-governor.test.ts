// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The governor against a model encoder: bits = complexity × 2^(−quantizer / 6), key frames
// five times dearer every 60 frames, and the answer three frames late, as WebCodecs is.
import { describe, expect, it } from "vitest";
import { BitrateGovernor, QUANTIZER_SCALES, lightBitsPerFrame } from "./bitrate-governor";

const TARGET = 12_000_000 / 30;
const DELAY = 3;

/** Complexity that the model encodes at TARGET bits a frame with this quantizer. */
const complexityAt = (quantizer: number) => TARGET * 2 ** (quantizer / 6);

function encode(frames: number, complexity: (frame: number) => number) {
  const governor = new BitrateGovernor({ bitsPerFrame: TARGET, scale: QUANTIZER_SCALES.avc });
  const pending: number[] = [];
  const quantizers: number[] = [];
  let bits = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const quantizer = governor.quantizer;
    quantizers.push(quantizer);
    const spent = complexity(frame) * (frame % 60 === 0 ? 5 : 1) * 2 ** (-quantizer / 6);
    bits += spent;
    pending.push(spent);
    if (pending.length > DELAY) governor.record(pending.shift() ?? 0);
  }
  return { bitsPerFrame: bits / frames, quantizers };
}

describe("BitrateGovernor", () => {
  it("brings a 15 s story to the tier's rate from its start", () => {
    const { bitsPerFrame, quantizers } = encode(435, () => complexityAt(12));
    expect(bitsPerFrame / TARGET).toBeGreaterThan(0.9);
    expect(bitsPerFrame / TARGET).toBeLessThan(1.1);
    expect(quantizers[0]).toBe(QUANTIZER_SCALES.avc.start);
    expect(Math.abs((quantizers.at(-1) ?? 0) - 12)).toBeLessThanOrEqual(1);
  });

  it("follows a busier passage up the scale and stays near the budget", () => {
    const { bitsPerFrame, quantizers } = encode(900, (frame) => complexityAt(frame < 300 ? 10 : 22));
    expect(bitsPerFrame / TARGET).toBeGreaterThan(0.9);
    expect(bitsPerFrame / TARGET).toBeLessThan(1.15);
    expect(quantizers.at(-1)).toBeGreaterThanOrEqual(20);
  });

  it("never pads: a plain picture stops at the finest quantizer, below the budget", () => {
    const { bitsPerFrame, quantizers } = encode(435, () => complexityAt(-8));
    expect(quantizers.at(-1)).toBe(QUANTIZER_SCALES.avc.min);
    expect(bitsPerFrame).toBeLessThan(TARGET / 2);
  });

  it("reports a dark picture's light at the finest quantizer: its quality check, not the rate", () => {
    const governor = new BitrateGovernor({ bitsPerFrame: TARGET, scale: QUANTIZER_SCALES.avc });
    for (let frame = 0; frame < 300; frame += 1) {
      const quantizer = governor.nextLightQuantizer();
      governor.record(complexityAt(-8) * 2 ** (-quantizer / 6));
    }
    const report = governor.report();
    expect(report).toMatchObject({ lightFrames: 300, finestQuantizer: QUANTIZER_SCALES.avc.min });
    expect(report.finestFrames / report.lightFrames).toBeGreaterThan(0.9);
  });
  it("counts no finest frame where the budget holds the picture above the floor", () => {
    const governor = new BitrateGovernor({ bitsPerFrame: TARGET, scale: QUANTIZER_SCALES.avc });
    for (let frame = 0; frame < 300; frame += 1) {
      const quantizer = governor.nextLightQuantizer();
      governor.record(complexityAt(12) * 2 ** (-quantizer / 6));
    }
    expect(governor.report().finestFrames).toBe(0);
  });
  it("stays inside the codec's scale on a picture no budget can hold", () => {
    const { quantizers } = encode(435, () => complexityAt(80));
    expect(Math.max(...quantizers)).toBeLessThanOrEqual(QUANTIZER_SCALES.avc.max);
    expect(quantizers.at(-1)).toBe(QUANTIZER_SCALES.avc.max);
  });
});

describe("lightBitsPerFrame", () => {
  it("gives the card's share of the file to the light", () => {
    expect(lightBitsPerFrame(12_000_000, 30, 495, 435)).toBeCloseTo((400_000 * 495) / 435, 6);
    expect(lightBitsPerFrame(12_000_000, 30, 60, 0)).toBe(400_000 * 60);
  });
});
