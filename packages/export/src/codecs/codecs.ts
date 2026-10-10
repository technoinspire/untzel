// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's codecs and their WebCodecs configurations. Video is H.264 High,
// always: on the hardware encoder or, where it refuses, the software one. The codec string
// carries the level, so it follows the frame size. Which codec a device really encodes is
// found by codec-probe.ts under the rule of codec-rule.ts.
import { AUDIO_POLICY, H264_POLICY, type AudioCodecName, type EncoderAcceleration } from "./codec-rule";
import { FPS, SAMPLE_RATE } from "../plan";
import { AAC_BITRATE, frameSize, VIDEO_BITRATES, type FrameSize } from "../probe/tiers";

export type { AudioCodecName, EncoderAcceleration } from "./codec-rule";
export type VideoCodecName = "avc";

export interface VideoCodecChoice {
  readonly name: VideoCodecName;
  /** The WebCodecs string at HD (level 4.0); videoCodecString gives the one of a frame size. */
  readonly codec: string;
  readonly acceleration: EncoderAcceleration;
}
export interface AudioCodecChoice {
  readonly name: AudioCodecName;
  readonly codec: string;
  readonly bitrate: number;
}

export const KEY_FRAME_SECONDS = 2;
/** H.264 High 4.0 (1080 × 1920 at 30 fps) on one encoder. */
export function h264Choice(acceleration: EncoderAcceleration): VideoCodecChoice {
  return { name: "avc", codec: "avc1.640028", acceleration };
}
/** Hardware first, then software: the only video choices there are. */
export const VIDEO_CODECS: readonly VideoCodecChoice[] = H264_POLICY.candidates.map(h264Choice);
const AUDIO_CHOICES: Readonly<Record<AudioCodecName, AudioCodecChoice>> = {
  aac: { name: "aac", codec: "mp4a.40.2", bitrate: AAC_BITRATE },
  opus: { name: "opus", codec: "opus", bitrate: 160_000 },
};
export function audioChoice(name: AudioCodecName): AudioCodecChoice {
  return AUDIO_CHOICES[name];
}
/** AAC first; Opus only where AAC is refused (codec-rule.ts). */
export const AUDIO_CODECS: readonly AudioCodecChoice[] = AUDIO_POLICY.candidates.map(audioChoice);
/** H.264 level 4.0 holds 8 192 macroblocks a frame (1080 × 1920 is 8 160); above, 5.1. */
const LEVEL_4_MACROBLOCKS = 8_192;
/** The frame the codec probe encodes: the HD story. */
export const PROBE_FRAME = frameSize("story", "hd");

/** The codec string of a frame size: the level grows with the pixels, never the profile. */
export function videoCodecString(frame: FrameSize): string {
  const macroblocks = Math.ceil(frame.width / 16) * Math.ceil(frame.height / 16);
  return macroblocks <= LEVEL_4_MACROBLOCKS ? "avc1.640028" : "avc1.640033";
}
/** The warm-up's deadline (encoder-warm-up.ts); the probe's own grow per retry (codec-rule.ts). */
export const PROBE_DEADLINE_MS = 3_000;

/** False when the probe rejects or does not settle in time. */
export function withDeadline(probe: Promise<boolean>, deadlineMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), deadlineMs);
    probe.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}

/**
 * The constant-bitrate configuration of a frame size: what the render falls back to where
 * the encoder takes no per-frame quantizer (bitrate-governor.ts), and what picks the codec.
 */
export function videoEncoderConfig(choice: VideoCodecChoice, frame: FrameSize = PROBE_FRAME, bitrate: number = VIDEO_BITRATES.hd): VideoEncoderConfig {
  return {
    codec: videoCodecString(frame),
    width: frame.width,
    height: frame.height,
    bitrate,
    bitrateMode: "constant",
    framerate: FPS,
    latencyMode: "quality",
    hardwareAcceleration: choice.acceleration,
    avc: { format: "avc" },
  };
}

/** The render's first choice: a quantizer per frame, steered by the BitrateGovernor. */
export function quantizerEncoderConfig(choice: VideoCodecChoice, frame: FrameSize): VideoEncoderConfig {
  const { bitrate: _bitrate, ...config } = videoEncoderConfig(choice, frame);
  return { ...config, bitrateMode: "quantizer" };
}

export function audioEncoderConfig(choice: AudioCodecChoice): AudioEncoderConfig {
  return { codec: choice.codec, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: choice.bitrate };
}
