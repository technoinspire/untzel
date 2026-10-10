// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Story and video: light frames drawn at fixed instants with the brand mark over them,
// the export sound, and the closing card in the last 60 frames (FrameComposer), encoded
// by WebCodecs and muxed by Mediabunny into a progressive MP4 with the moov first: room
// for the moov is reserved from the packet budget and the file is kept as Blob parts while
// it renders, never as one buffer. Frame i shows audio time
// startFrame / 48 000 + i / 30.
import {
  AudioSample,
  AudioSampleSource,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSample,
  VideoSampleSource,
} from "mediabunny";
import type { OfflineStage } from "@untzel/light/offline";
import { BitrateGovernor, lightBitsPerFrame, QUANTIZER_SCALES, type RateControlReport } from "./bitrate-governor";
import { createBlobTarget } from "./blob-target";
import { ATTRIBUTION_COMMENT } from "../brand/card";
import { KEY_FRAME_SECONDS, videoCodecString, type AudioCodecChoice, type VideoCodecChoice } from "../codecs/codecs";
import { FrameComposer, type FrameBranding } from "./frame-composer";
import { packetBudget } from "./packet-budget";
import { FPS, SAMPLES_PER_VIDEO_FRAME, type ExportPlan } from "../plan";
import { VIDEO_FADE_FRAMES, renderAudio, yieldToEvents, type ExportAudio } from "../audio/render-audio";
import type { FrameTitle } from "../title/title-overlays";

/** Audio is handed to the muxer one second at a time, ahead of the frames it covers. */
const AUDIO_BLOCK_VIDEO_FRAMES = FPS;
export const PROGRESS_EVERY_FRAMES = 15;
export const MP4_MIME = "video/mp4";

export interface VideoRenderInput {
  readonly plan: ExportPlan;
  readonly audio: ExportAudio;
  readonly stage: OfflineStage;
  readonly canvas: OffscreenCanvas;
  /** prepareVideoBranding's mark and card, checked by the worker. */
  readonly branding: FrameBranding;
  /** The song's title card and caption, checked by the worker; null for none. */
  readonly title: FrameTitle | null;
  /** The song's title for the MP4 metadata; null without one. */
  readonly songTitle: string | null;
  readonly video: VideoCodecChoice;
  readonly sound: AudioCodecChoice;
  /** Measured encoder delay in samples (priming); every audio timestamp moves that much earlier. */
  readonly audioDelay: number;
  readonly onProgress: (done: number, total: number) => void;
  readonly isCancelled: () => boolean;
}

export type VideoRenderResult =
  | {
      readonly kind: "done";
      readonly blob: Blob;
      readonly audioSamples: number;
      /** Null where the encoder refused a quantizer per frame (constant bitrate). */
      readonly rateControl: RateControlReport | null;
    }
  | { readonly kind: "cancelled" };

// Over 40 lines: the export's frame loop; the encoder, the bitrate governor and the audio blocks share one pass, frame by frame.
export async function renderVideo(input: VideoRenderInput): Promise<VideoRenderResult> {
  const { plan, stage, canvas } = input;
  if (plan.frame === null || plan.videoBitrate === null) throw new Error("export: a video plan needs a frame and a bitrate");
  const composer = new FrameComposer({ frame: plan.frame, branding: input.branding, reducedMotion: plan.reducedMotion, title: input.title });
  const file = createBlobTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "reserve" }), target: file.target });
  const packets = packetBudget(plan);
  // A quantizer per frame from the governor, where the encoder takes one; otherwise (it
  // refuses quantizer control) the constant bitrate, which the encoder treats as a ceiling.
  const scale = QUANTIZER_SCALES[input.video.name];
  const governor = new BitrateGovernor({ bitsPerFrame: lightBitsPerFrame(plan.videoBitrate, FPS, plan.totalVideoFrames, plan.musicVideoFrames), scale });
  let isGoverned = false;
  const videoSource = new VideoSampleSource({
    codec: input.video.name,
    fullCodecString: videoCodecString(plan.frame),
    quality: new Quality({ quantizer: scale.start, bitrate: plan.videoBitrate, bitrateMode: "constant" }),
    keyFrameInterval: KEY_FRAME_SECONDS,
    latencyMode: "quality",
    // The encoder the codec probe found (codec-rule.ts): H.264 on the hardware or in software.
    hardwareAcceleration: input.video.acceleration,
    // Called for each configuration tried, in order: the last one is the one in use.
    onEncoderConfig: (config) => void (isGoverned = config.bitrateMode === "quantizer"),
    // The card is one still picture: only the light's bits steer the light.
    onEncodedPacket: (packet) => {
      if (Math.round(packet.timestamp * FPS) < plan.musicVideoFrames) governor.record(packet.byteLength * 8);
    },
  });
  const audioSource = new AudioSampleSource({ codec: input.sound.name, bitrate: input.sound.bitrate });
  output.addVideoTrack(videoSource, { frameRate: FPS, maximumPacketCount: packets.video });
  output.addAudioTrack(audioSource, { maximumPacketCount: packets.audio });
  output.setMetadataTags({ comment: ATTRIBUTION_COMMENT, ...(input.songTitle === null ? {} : { title: input.songTitle }) });
  await output.start();

  const totalSamples = plan.totalVideoFrames * SAMPLES_PER_VIDEO_FRAME;
  const blocks = renderAudio(input.audio, totalSamples, VIDEO_FADE_FRAMES, AUDIO_BLOCK_VIDEO_FRAMES * SAMPLES_PER_VIDEO_FRAME);
  const startSeconds = input.audio.startFrame / plan.sampleRate;
  const delaySeconds = input.audioDelay / plan.sampleRate;
  let audioSamples = 0;

  for (let frame = 0; frame < plan.totalVideoFrames; frame += 1) {
    if (input.isCancelled()) {
      await output.cancel();
      return { kind: "cancelled" };
    }
    if (frame % AUDIO_BLOCK_VIDEO_FRAMES === 0) {
      const next = blocks.next();
      if (!next.done) {
        const { left, right } = next.value;
        const planar = new Float32Array(left.length * 2);
        planar.set(left, 0);
        planar.set(right, left.length);
        const sample = new AudioSample({
          data: planar,
          format: "f32-planar",
          numberOfChannels: 2,
          sampleRate: plan.sampleRate,
          timestamp: audioSamples / plan.sampleRate - delaySeconds,
        });
        audioSamples += left.length;
        await audioSource.add(sample);
        sample.close();
      }
    }
    const isCard = frame >= plan.musicVideoFrames;
    if (!isCard) stage.drawAt(startSeconds + frame / FPS);
    const picture = isCard ? composer.card(frame - plan.musicVideoFrames) : composer.light(canvas, frame);
    const sample = new VideoSample(picture, { timestamp: frame / FPS, duration: 1 / FPS });
    // The card does not lean on a music frame: its first frame is a key frame.
    const quantizer = isCard ? governor.quantizer : governor.nextLightQuantizer();
    await videoSource.add(sample, encodeOptions(frame === plan.musicVideoFrames, isGoverned ? quantizer : null));
    sample.close();
    if ((frame + 1) % PROGRESS_EVERY_FRAMES === 0 || frame + 1 === plan.totalVideoFrames) {
      input.onProgress(frame + 1, plan.totalVideoFrames);
      await yieldToEvents();
    }
  }
  await output.finalize();
  const blob = file.toBlob(MP4_MIME);
  if (blob.size === 0) throw new Error("export: the MP4 is empty");
  return { kind: "done", blob, audioSamples, rateControl: isGoverned ? governor.report() : null };
}

/** The frame's options: a key frame where the card starts, the governor's quantizer when it steers. */
function encodeOptions(isKeyFrame: boolean, quantizer: number | null): VideoEncoderEncodeOptions | undefined {
  if (!isKeyFrame && quantizer === null) return undefined;
  return { ...(isKeyFrame ? { keyFrame: true } : {}), ...(quantizer === null ? {} : { avc: { quantizer } }) };
}
