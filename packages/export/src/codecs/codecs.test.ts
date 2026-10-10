// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { AUDIO_CODECS, h264Choice, quantizerEncoderConfig, VIDEO_CODECS, videoCodecString, videoEncoderConfig } from "./codecs";
import { findPeak } from "../audio/priming";
describe("codecs", () => {
  it("offers H.264 High only, hardware first, and AAC before Opus", () => {
    expect(VIDEO_CODECS.map((choice) => [choice.codec, choice.acceleration])).toEqual([
      ["avc1.640028", "prefer-hardware"],
      ["avc1.640028", "prefer-software"],
    ]);
    expect(AUDIO_CODECS.map((choice) => choice.codec)).toEqual(["mp4a.40.2", "opus"]);
  });
  it("raises the level, never the profile, with the frame size", () => {
    expect(videoCodecString({ width: 1080, height: 1920 })).toBe("avc1.640028");
    expect(videoCodecString({ width: 3840, height: 2160 })).toBe("avc1.640033");
  });
  it("asks the encoder the choice names, in both rate modes", () => {
    const frame = { width: 1920, height: 1080 };
    expect(videoEncoderConfig(h264Choice("prefer-software"), frame, 12_000_000)).toMatchObject({ hardwareAcceleration: "prefer-software", bitrateMode: "constant", bitrate: 12_000_000 });
    expect(quantizerEncoderConfig(h264Choice("prefer-hardware"), frame)).toMatchObject({ hardwareAcceleration: "prefer-hardware", bitrateMode: "quantizer" });
    expect(quantizerEncoderConfig(h264Choice("prefer-hardware"), frame)).not.toHaveProperty("bitrate");
  });
});
describe("findPeak", () => {
  it("finds a decoded impulse delayed by 0, 1 024, 2 112 and 3 088 samples", () => {
    for (const delay of [0, 1_024, 2_112, 3_088]) {
      const signal = new Float32Array(9_600);
      for (let index = 0; index < signal.length; index += 1) signal[index] = 0.01 * Math.sin(index * 0.37);
      signal[delay] = 0.85;
      if (delay > 0) signal[delay - 1] = -0.4; // pre-echo of a lossy codec
      signal[delay + 1] = 0.5;
      expect(findPeak(signal)).toBe(delay);
    }
  });
});
