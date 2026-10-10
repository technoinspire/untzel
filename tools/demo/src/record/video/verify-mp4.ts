// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What ffprobe must say of a demo MP4: H.264
// High at 30 fps and the format's size, AAC at 48 kHz in stereo, the frames the capture made,
// the sound as long as the picture within a frame, and the attribution in the comment.
// Pure over `ffprobe -print_format json -show_streams -show_format`.
import { FPS } from "../frame-time";
import { ATTRIBUTION_COMMENT } from "./mux";

export interface Mp4Expectation {
  readonly width: number;
  readonly height: number;
  readonly frames: number;
}

export interface Mp4Facts {
  readonly videoCodec: string | null;
  readonly profile: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly frameRate: string | null;
  readonly frames: number | null;
  readonly pixelFormat: string | null;
  readonly videoSeconds: number | null;
  readonly audioCodec: string | null;
  readonly sampleRate: number | null;
  readonly channels: number | null;
  readonly audioSeconds: number | null;
  readonly comment: string | null;
}

export interface Mp4Verdict {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly facts: Mp4Facts;
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
}

function number(value: unknown): number | null {
  const read = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(read) ? read : null;
}

function streamOf(probe: Json, type: "video" | "audio"): Json {
  const streams = Array.isArray(probe["streams"]) ? probe["streams"] : [];
  return (streams.find((stream: unknown) => isRecord(stream) && stream["codec_type"] === type) as Json | undefined) ?? {};
}

function tagsOf(value: unknown): Json {
  return isRecord(value) && isRecord(value["tags"]) ? value["tags"] : {};
}

export function mp4Facts(probe: unknown): Mp4Facts {
  const root = isRecord(probe) ? probe : {};
  const video = streamOf(root, "video");
  const audio = streamOf(root, "audio");
  return {
    videoCodec: text(video["codec_name"]),
    profile: text(video["profile"]),
    width: number(video["width"]),
    height: number(video["height"]),
    frameRate: text(video["avg_frame_rate"]),
    frames: number(video["nb_frames"]),
    pixelFormat: text(video["pix_fmt"]),
    videoSeconds: number(video["duration"]),
    audioCodec: text(audio["codec_name"]),
    sampleRate: number(audio["sample_rate"]),
    channels: number(audio["channels"]),
    audioSeconds: number(audio["duration"]),
    comment: text(tagsOf(root["format"])["comment"]),
  };
}

export function verifyMp4(probe: unknown, expected: Mp4Expectation): Mp4Verdict {
  const facts = mp4Facts(probe);
  const problems: string[] = [];
  const want = (isFine: boolean, problem: string): void => {
    if (!isFine) problems.push(problem);
  };

  want(facts.videoCodec === "h264", `video codec ${facts.videoCodec}, not h264`);
  want(facts.profile === "High", `H.264 profile ${facts.profile}, not High`);
  want(facts.width === expected.width && facts.height === expected.height, `frame ${facts.width}×${facts.height}, not ${expected.width}×${expected.height}`);
  want(facts.frameRate === `${FPS}/1`, `frame rate ${facts.frameRate}, not ${FPS}/1`);
  want(facts.frames === expected.frames, `${facts.frames} video frames, not ${expected.frames}`);
  want(facts.pixelFormat === "yuv420p", `pixel format ${facts.pixelFormat}, not yuv420p`);
  want(facts.audioCodec === "aac", `audio codec ${facts.audioCodec}, not aac`);
  want(facts.sampleRate === 48_000, `audio at ${facts.sampleRate} Hz, not 48000`);
  want(facts.channels === 2, `${facts.channels} audio channels, not 2`);
  const gap = facts.videoSeconds === null || facts.audioSeconds === null ? Number.POSITIVE_INFINITY : Math.abs(facts.videoSeconds - facts.audioSeconds);
  want(gap <= 1 / FPS + 1e-6, `sound and picture differ by ${gap.toFixed(4)} s, more than a frame`);
  want(facts.comment === ATTRIBUTION_COMMENT, `comment ${JSON.stringify(facts.comment)}, not the attribution`);
  return { ok: problems.length === 0, problems, facts };
}
