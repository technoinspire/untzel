// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// After the capture: the WAV checked against the frames,
// the MP4 of the whole capture, and for a Story its 1:00 cut; each MP4 checked by ffprobe,
// by the export lab for its cards, and against the attribution samples of the capture.
import { execFile } from "node:child_process";
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { BrowserSession } from "../browser-session";
import type { CaptureFormat } from "./capture-formats";
import { MAX_STORY_SECONDS } from "../capture-length";
import { BRAND_CARD_FRAMES, SAMPLES_PER_VIDEO_FRAME, TITLE_CARD_FRAMES, secondsOfFrames } from "../frame-time";
import { checkWavLength, mux } from "./mux";
import { joinWavSpans, storyCut, wavFrames } from "./story-cut";
import { attributionFrames, attributionVerdict, cardVerdict, inspectCards, type AttributionSample } from "./verify-frames";
import { verifyMp4 } from "./verify-mp4";

const run = promisify(execFile);

/** The export's 10 ms fade at a join, at 48 kHz. */
const JOIN_FADE_SAMPLES = 480;


export interface VideoInputs {
  readonly session: BrowserSession;
  readonly tools: { readonly ffmpeg: string; readonly ffprobe: string };
  readonly format: CaptureFormat;
  readonly demo: string;
  readonly directory: string;
  readonly framesDirectory: string;
  readonly capture: { readonly frames: number; readonly attribution: readonly AttributionSample[] };
  readonly title: string | null;
  readonly wav: string;
  /** The frame each layer of the plan starts on. */
  readonly layerFrames: readonly number[];
}

export interface VideoChecks {
  readonly ok: boolean;
  readonly report: Readonly<Record<string, unknown>>;
}

interface Checked {
  readonly ok: boolean;
  readonly report: Readonly<Record<string, unknown>>;
}

async function probe(ffprobe: string, file: string): Promise<unknown> {
  const { stdout } = await run(ffprobe, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], { maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout) as unknown;
}

/** Muxes `frames` frames of `framesDirectory` with `wav` into `out`, then checks the file. */
async function video(inputs: VideoInputs, framesDirectory: string, frames: number, wav: string, out: string): Promise<Checked> {
  await mux(inputs.tools.ffmpeg, { framesDirectory, frames, wav, out, title: inputs.title });
  const mp4 = verifyMp4(await probe(inputs.tools.ffprobe, out), { ...inputs.format.frame, frames });
  const cards = cardVerdict(await inspectCards(inputs.session.page, out), BRAND_CARD_FRAMES);
  return { ok: mp4.ok && cards.ok, report: { file: out, seconds: secondsOfFrames(frames), mp4, cards } };
}

/** The Story's frames: the title card, the end of the build from the cut, the closing card. */
function storyFrames(inputs: VideoInputs, fromFrame: number): { readonly directory: string; readonly frames: number } {
  const directory = join(inputs.directory, "story-frames");
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const total = inputs.capture.frames + BRAND_CARD_FRAMES;
  const sources = [...Array.from({ length: TITLE_CARD_FRAMES }, (_, frame) => frame), ...Array.from({ length: total - fromFrame }, (_, index) => fromFrame + index)];
  const name = (frame: number): string => `frame-${String(frame).padStart(6, "0")}.png`;
  sources.forEach((source, index) => linkSync(join(inputs.framesDirectory, name(source)), join(directory, name(index))));
  return { directory, frames: sources.length };
}

async function story(inputs: VideoInputs, wav: Uint8Array): Promise<Checked> {
  const cut = storyCut(inputs.layerFrames, inputs.capture.frames);
  const frames = storyFrames(inputs, cut.fromFrame);
  const total = (inputs.capture.frames + BRAND_CARD_FRAMES) * SAMPLES_PER_VIDEO_FRAME;
  const sound = joinWavSpans(wav, [{ from: 0, to: TITLE_CARD_FRAMES * SAMPLES_PER_VIDEO_FRAME }, { from: cut.fromFrame * SAMPLES_PER_VIDEO_FRAME, to: total }], JOIN_FADE_SAMPLES);
  const storyWav = join(inputs.directory, "story.wav");
  writeFileSync(storyWav, sound);
  const length = checkWavLength(wavFrames(sound), frames.frames);
  const checked = await video(inputs, frames.directory, frames.frames, storyWav, join(inputs.directory, `${inputs.demo}-story.mp4`));
  rmSync(frames.directory, { recursive: true, force: true });
  const isShort = secondsOfFrames(frames.frames) <= MAX_STORY_SECONDS;
  return { ok: checked.ok && length.ok && isShort, report: { ...checked.report, cut, wav: length, isAtMostOneMinute: isShort } };
}

export async function finishVideos(inputs: VideoInputs): Promise<VideoChecks> {
  const wav = new Uint8Array(readFileSync(inputs.wav));
  const frames = inputs.capture.frames + BRAND_CARD_FRAMES;
  const length = checkWavLength(wavFrames(wav), frames);
  const attribution = attributionVerdict(inputs.capture.attribution, attributionFrames(TITLE_CARD_FRAMES, inputs.capture.frames - 1));
  if (!length.ok) return { ok: false, report: { wav: length, attribution } };
  const isStory = inputs.format.name === "story";
  const whole = await video(inputs, inputs.framesDirectory, frames, inputs.wav, join(inputs.directory, `${inputs.demo}-${isStory ? "story-full" : inputs.format.name}.mp4`));
  const cut = isStory ? await story(inputs, wav) : null;
  const ok = length.ok && attribution.ok && whole.ok && (cut?.ok ?? true);
  return { ok, report: { wav: length, attribution, video: whole.report, ...(cut === null ? {} : { story: cut.report }) } };
}
