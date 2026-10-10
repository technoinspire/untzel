// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifyMp4 } from "./verify-mp4";

// ffprobe of a 1 s, 30-frame MP4 made with muxArguments' settings at 1920 × 1080.
const RECORDED = JSON.parse(readFileSync(new URL("./fixtures/ffprobe-video-1s.json", import.meta.url), "utf8")) as {
  streams: Record<string, unknown>[];
  format: { tags: Record<string, unknown> };
};
const EXPECTED = { width: 1920, height: 1080, frames: 30 };

function changed(edit: (probe: typeof RECORDED) => void): typeof RECORDED {
  const probe = structuredClone(RECORDED);
  edit(probe);
  return probe;
}

const stream = (probe: typeof RECORDED, type: string): Record<string, unknown> => probe.streams.find((entry) => entry["codec_type"] === type) ?? {};

describe("verifyMp4", () => {
  it("passes the recorded file: H.264 High at 30 fps, AAC 48 kHz stereo, the attribution", () => {
    const verdict = verifyMp4(RECORDED, EXPECTED);
    expect(verdict.problems).toEqual([]);
    expect(verdict.facts).toMatchObject({ videoCodec: "h264", profile: "High", frameRate: "30/1", frames: 30, audioCodec: "aac", sampleRate: 48_000, channels: 2 });
  });
  it("names a wrong size and a wrong frame count", () => {
    const verdict = verifyMp4(RECORDED, { width: 1080, height: 1920, frames: 31 });
    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toEqual(["frame 1920×1080, not 1080×1920", "30 video frames, not 31"]);
  });
  it("names a profile, a rate and a sound that are not the format's", () => {
    const probe = changed((copy) => {
      stream(copy, "video")["profile"] = "Main";
      stream(copy, "video")["avg_frame_rate"] = "25/1";
      stream(copy, "audio")["sample_rate"] = "44100";
      stream(copy, "audio")["channels"] = 1;
    });
    expect(verifyMp4(probe, EXPECTED).problems).toEqual([
      "H.264 profile Main, not High",
      "frame rate 25/1, not 30/1",
      "audio at 44100 Hz, not 48000",
      "1 audio channels, not 2",
    ]);
  });
  it("refuses sound longer than the picture by more than a frame, and a file without the attribution", () => {
    const probe = changed((copy) => {
      stream(copy, "audio")["duration"] = "1.050000";
      delete copy.format.tags["comment"];
    });
    expect(verifyMp4(probe, EXPECTED).problems).toEqual(["sound and picture differ by 0.0500 s, more than a frame", "comment null, not the attribution"]);
  });
  it("refuses a file without a sound track", () => {
    const probe = changed((copy) => {
      copy.streams = copy.streams.filter((entry) => entry["codec_type"] !== "audio");
    });
    expect(verifyMp4(probe, EXPECTED).ok).toBe(false);
  });
});
