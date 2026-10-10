// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { chooseTiers, ENCODER_START_SECONDS, estimateRenderSeconds, frameSize, isCompleteProbe, maxSecondsFor, VIDEO_FORMATS, type DeviceProbe, type TierProbe, type VideoFormat } from "./tiers";

const tier = (quality: TierProbe["quality"], isSupported: boolean, framesPerSecond: number | null): TierProbe => ({ quality, isSupported, framesPerSecond });
const probe = (...tiers: TierProbe[]): DeviceProbe => ({ tiers });

describe("isCompleteProbe", () => {
  it("keeps a probe that timed every tier it had to", () => {
    expect(isCompleteProbe(probe(tier("hd", true, 90), tier("4k", true, 31)))).toBe(true);
    // HD below real time: 4K was never timed, and that is an answer.
    expect(isCompleteProbe(probe(tier("hd", true, 20), tier("4k", true, null)))).toBe(true);
    // 4K refused by isConfigSupported: also an answer.
    expect(isCompleteProbe(probe(tier("hd", true, 90), tier("4k", false, null)))).toBe(true);
  });

  it("does not keep a probe whose timing missed its deadline, nor one without H.264 at HD", () => {
    expect(isCompleteProbe(probe(tier("hd", true, null), tier("4k", true, null)))).toBe(false);
    expect(isCompleteProbe(probe(tier("hd", true, 90), tier("4k", true, null)))).toBe(false);
    expect(isCompleteProbe(probe(tier("hd", false, null), tier("4k", false, null)))).toBe(false);
    expect(isCompleteProbe(probe(tier("hd", true, 90)))).toBe(false);
  });
});

describe("frame sizes", () => {
  it("are the tiers: HD and 4K, 9:16 and 16:9", () => {
    expect(frameSize("story", "hd")).toEqual({ width: 1080, height: 1920 });
    expect(frameSize("video", "hd")).toEqual({ width: 1920, height: 1080 });
    expect(frameSize("story", "4k")).toEqual({ width: 2160, height: 3840 });
    expect(frameSize("video", "4k")).toEqual({ width: 3840, height: 2160 });
  });

  it("keep a 4K file under 1 GB: 4:23 at 30 Mbit/s, and HD past the 10 min limit", () => {
    expect(maxSecondsFor("4k")).toBe(263);
    expect(maxSecondsFor("hd")).toBeGreaterThan(600);
  });
});

describe("chooseTiers", () => {
  it("offers HD alone, with no estimate, before the device is probed", () => {
    expect(chooseTiers(null)).toEqual({
      offers: [
        { quality: "hd", realtimeFactor: null, isRealtime: false },
        { quality: "4k", realtimeFactor: null, isRealtime: false },
      ],
      defaultQuality: "hd",
      isProbed: false,
    });
  });

  it("offers 4K and defaults to it on a device that renders it at real time", () => {
    const choice = chooseTiers(probe(tier("hd", true, 120), tier("4k", true, 33)));
    expect(choice.offers.map((offer) => offer.quality)).toEqual(["hd", "4k"]);
    expect(choice.defaultQuality).toBe("4k");
    expect(choice.offers[1]?.realtimeFactor).toBeCloseTo(1.1, 6);
  });

  it("counts about 1× as real time: 0.9× passes, 0.89× does not", () => {
    expect(chooseTiers(probe(tier("hd", true, 60), tier("4k", true, 27))).offers).toHaveLength(2);
    expect(chooseTiers(probe(tier("hd", true, 60), tier("4k", true, 26.7))).offers).toHaveLength(1);
  });

  it("never shows 4K where the encoder refuses it, however fast the probe was", () => {
    const choice = chooseTiers(probe(tier("hd", true, 90), tier("4k", false, 90)));
    expect(choice.offers.map((offer) => offer.quality)).toEqual(["hd"]);
    expect(choice.defaultQuality).toBe("hd");
  });

  it("still offers HD on a phone that cannot do it in real time: it renders offline, slower", () => {
    const choice = chooseTiers(probe(tier("hd", true, 12), tier("4k", true, null)));
    expect(choice.offers).toEqual([{ quality: "hd", realtimeFactor: 0.4, isRealtime: false }]);
    expect(choice.defaultQuality).toBe("hd");
    expect(choice.isProbed).toBe(true);
  });
});

describe("estimateRenderSeconds", () => {
  it("is the frames over the measured pace", () => {
    const offer = { quality: "hd" as const, realtimeFactor: 2, isRealtime: true };
    // 510 frames (a 15 s story and its card) at 60 frames/s.
    expect(estimateRenderSeconds(510, offer, true)).toBeCloseTo(8.5, 6);
    expect(estimateRenderSeconds(510, { ...offer, realtimeFactor: 0.4 }, true)).toBeCloseTo(42.5, 6);
  });

  it("adds the encoder's one-time start while no encoder has run on the page", () => {
    const offer = { quality: "hd" as const, realtimeFactor: 2, isRealtime: true };
    expect(ENCODER_START_SECONDS).toBe(2);
    expect(estimateRenderSeconds(510, offer, false)).toBeCloseTo(8.5 + ENCODER_START_SECONDS, 6);
  });

  it("has no number before the probe", () => {
    expect(estimateRenderSeconds(510, { quality: "hd", realtimeFactor: null, isRealtime: false }, false)).toBeNull();
  });
});

describe("VIDEO_FORMATS", () => {
  it("lists every member of VideoFormat, so a new format cannot miss the brand zones", () => {
    // Exhaustive: a format added to the union and not here fails to type-check.
    const every: Record<VideoFormat, true> = { story: true, video: true };
    expect([...VIDEO_FORMATS].sort()).toEqual(Object.keys(every).sort());
  });
});
