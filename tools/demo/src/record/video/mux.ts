// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The MP4: the captured PNGs at 30 fps and the take's
// WAV, put together by the system's ffmpeg with an argument list, never through a shell.
// H.264 High at a fixed quality, 4:2:0, AAC 320 kbit/s at 48 kHz, the index up front, and
// the attribution in the file's comment. The sound must cover the frames to the sample
// (±1 frame) before anything is written.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { FPS, SAMPLES_PER_VIDEO_FRAME } from "../frame-time";

const run = promisify(execFile);

/** The attribution every video carries, also in its metadata. */
export const ATTRIBUTION_COMMENT = "Powered by Untzel · Techno Inspire · https://untzel.com";

const HOMEBREW = "/opt/homebrew/bin";

/** ffmpeg or ffprobe: Homebrew's first, then the PATH; null when neither has it. */
export function findTool(name: "ffmpeg" | "ffprobe", path: string = process.env["PATH"] ?? ""): string | null {
  for (const folder of [HOMEBREW, ...path.split(delimiter).filter((entry) => entry !== "")]) {
    const candidate = join(folder, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export interface MuxInput {
  /** frame-000000.png, frame-000001.png, … in this folder, from 0. */
  readonly framesDirectory: string;
  readonly frames: number;
  readonly wav: string;
  readonly out: string;
  /** The song's title for the file's tags; null leaves the tag out. */
  readonly title: string | null;
}

export function muxArguments(input: MuxInput): string[] {
  return [
    "-y",
    "-loglevel", "error",
    "-framerate", String(FPS),
    "-start_number", "0",
    "-i", join(input.framesDirectory, "frame-%06d.png"),
    "-i", input.wav,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-frames:v", String(input.frames),
    "-c:v", "libx264",
    "-profile:v", "high",
    "-preset", "slow",
    "-crf", "16",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-c:a", "aac",
    "-b:a", "320k",
    "-ar", "48000",
    "-ac", "2",
    "-movflags", "+faststart",
    "-metadata", `comment=${ATTRIBUTION_COMMENT}`,
    ...(input.title === null ? [] : ["-metadata", `title=${input.title}`]),
    input.out,
  ];
}

export interface WavLengthCheck {
  readonly ok: boolean;
  readonly samples: number;
  readonly expected: number;
}

/** The sound of `frames` video frames: frames × 1 600 samples, one frame either way. */
export function checkWavLength(samples: number, frames: number): WavLengthCheck {
  const expected = frames * SAMPLES_PER_VIDEO_FRAME;
  return { ok: Math.abs(samples - expected) <= SAMPLES_PER_VIDEO_FRAME, samples, expected };
}

export async function mux(ffmpeg: string, input: MuxInput): Promise<void> {
  await run(ffmpeg, muxArguments(input), { maxBuffer: 16 * 1024 * 1024 });
}

/** ffmpeg answers with its version and was built with libx264. */
export async function hasLibx264(ffmpeg: string): Promise<boolean> {
  try {
    const { stdout } = await run(ffmpeg, ["-hide_banner", "-encoders"], { maxBuffer: 16 * 1024 * 1024 });
    return /\blibx264\b/.test(stdout);
  } catch {
    return false;
  }
}
