// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { QUANTIZER_SCALES } from "../video/bitrate-governor";
import { quantizerEncoderConfig, videoEncoderConfig, VIDEO_CODECS } from "../codecs/codecs";
import { probeDevice, probeEncodeOptions, withinDeadline, type ProbeEnvironment } from "./device-probe";
import { probeCues, probeProgram } from "./probe-light";

function environment(supported: (codec: string) => boolean, fps: Record<number, number | null>) {
  const timed: number[] = [];
  const env: ProbeEnvironment = {
    isConfigSupported: async (config) => supported(config.codec),
    timeFrames: async (frame) => {
      timed.push(frame.width);
      return fps[frame.width] ?? null;
    },
  };
  return { env, timed };
}

describe("probeDevice", () => {
  it("times HD and 4K on the 16:9 frame with the final configuration", async () => {
    const { env, timed } = environment(() => true, { 1920: 90, 3840: 31 });
    expect(await probeDevice(env)).toEqual({
      tiers: [
        { quality: "hd", isSupported: true, framesPerSecond: 90 },
        { quality: "4k", isSupported: true, framesPerSecond: 31 },
      ],
    });
    expect(timed).toEqual([1920, 3840]);
  });

  it("does not time 4K when HD fell below real time", async () => {
    const { env, timed } = environment(() => true, { 1920: 20 });
    expect((await probeDevice(env)).tiers[1]).toEqual({ quality: "4k", isSupported: true, framesPerSecond: null });
    expect(timed).toEqual([1920]);
  });

  it("asks for level 5.1 at 4K, H.264 only, hardware then software, and never VP9", async () => {
    const asked: string[] = [];
    const env: ProbeEnvironment = {
      isConfigSupported: async (config) => (asked.push(`${config.codec} ${config.hardwareAcceleration} ${config.bitrateMode}`), config.hardwareAcceleration === "prefer-software" && config.bitrateMode === "constant"),
      timeFrames: async () => 60,
    };
    const probe = await probeDevice(env);
    // Per encoder, the quantizer configuration first, then the constant bitrate.
    const order = (codec: string) => [
      `${codec} prefer-hardware quantizer`,
      `${codec} prefer-hardware constant`,
      `${codec} prefer-software quantizer`,
      `${codec} prefer-software constant`,
    ];
    expect(asked).toEqual([...order("avc1.640028"), ...order("avc1.640033")]);
    expect(probe.tiers.every((tier) => tier.isSupported)).toBe(true);
  });

  it("marks every tier unsupported where no H.264 configuration is accepted", async () => {
    const { env, timed } = environment(() => false, {});
    expect((await probeDevice(env)).tiers.map((tier) => tier.isSupported)).toEqual([false, false]);
    expect(timed).toEqual([]);
  });

  it("times the render's rate control: the quantizer where taken, the constant bitrate otherwise", async () => {
    const timedModes: (string | undefined)[] = [];
    const env = (acceptsQuantizer: boolean): ProbeEnvironment => ({
      isConfigSupported: async (config) => acceptsQuantizer || config.bitrateMode !== "quantizer",
      timeFrames: async (_frame, config) => (timedModes.push(config.bitrateMode), 60),
    });
    await probeDevice(env(true));
    await probeDevice(env(false));
    expect(timedModes).toEqual(["quantizer", "quantizer", "constant", "constant"]);
  });

  it("marks a refused tier unsupported and does not time it", async () => {
    const { env, timed } = environment((codec) => !codec.endsWith("33") && !codec.includes(".51."), { 1920: 60 });
    expect((await probeDevice(env)).tiers[1]).toEqual({ quality: "4k", isSupported: false, framesPerSecond: null });
    expect(timed).toEqual([1920]);
  });

  it("draws a busy second: kicks, hats, a ribbon and fog", () => {
    const families = new Set(probeProgram().scenes.map((scene) => scene.family));
    expect([...families].sort()).toEqual(["fog", "ribbon", "shockwave", "sparks"]);
    expect(probeCues().every((cue) => cue.audioTime < 1)).toBe(true);
  });
});

describe("withinDeadline", () => {
  it("is true when the work settles first", async () => {
    expect(await withinDeadline(Promise.resolve(), 50)).toBe(true);
  });

  it("is false when the work never settles, such as a flush that never comes", async () => {
    expect(await withinDeadline(new Promise(() => undefined), 5)).toBe(false);
  });

  it("passes a failure on to the caller", async () => {
    await expect(withinDeadline(Promise.reject(new Error("closed")), 50)).rejects.toThrow("closed");
  });
});

describe("probeEncodeOptions", () => {
  const frame = { width: 1920, height: 1080 };

  it("hands each frame the governor's starting quantizer in quantizer mode", () => {
    expect(probeEncodeOptions(quantizerEncoderConfig(VIDEO_CODECS[0]!, frame), true)).toEqual({ keyFrame: true, avc: { quantizer: QUANTIZER_SCALES.avc.start } });
    expect(probeEncodeOptions(quantizerEncoderConfig(VIDEO_CODECS[1]!, frame), false)).toEqual({ keyFrame: false, avc: { quantizer: QUANTIZER_SCALES.avc.start } });
  });

  it("hands only the key frame flag at a constant bitrate", () => {
    expect(probeEncodeOptions(videoEncoderConfig(VIDEO_CODECS[0]!, frame, 12_000_000), false)).toEqual({ keyFrame: false });
  });
});
