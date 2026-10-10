// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The device probe, run in an export worker on the first Render of a device:
// per tier, VideoEncoder.isConfigSupported with the final configuration and, if accepted,
// about 1 s of light drawn offscreen by the same OfflineStage at the tier's size and
// really encoded, with the render's rate control (a quantizer per frame where the encoder
// takes one, the constant bitrate otherwise). The pace in frames per second is what chooseTiers decides from. 4K is
// only timed when HD kept up with real time: a device that cannot do HD at 1× cannot do 4K.
import { createOfflineStage } from "@untzel/light/offline";
import { exportKeepOut } from "../brand/brand-exclusion";
import { PROBE_TIMELINE, probeCues, probeProgram } from "./probe-light";
import { QUANTIZER_SCALES } from "../video/bitrate-governor";
import { quantizerEncoderConfig, VIDEO_CODECS, videoEncoderConfig } from "../codecs/codecs";
import { FPS } from "../plan";
import { frameSize, QUALITIES, REALTIME_FLOOR, VIDEO_BITRATES, type DeviceProbe, type FrameSize, type TierProbe } from "./tiers";

/** One second of video. */
export const PROBE_FRAMES = FPS;
/** A tier slower than this is stopped and timed on the frames it finished. */
export const PROBE_TIER_DEADLINE_MS = 3_000;

/** What the probe needs from the browser; tests pass a fake. */
export interface ProbeEnvironment {
  isConfigSupported(config: VideoEncoderConfig): Promise<boolean>;
  /** Frames per second drawing and encoding PROBE_FRAMES frames, or null when it failed. */
  timeFrames(frame: FrameSize, config: VideoEncoderConfig): Promise<number | null>;
}

export async function probeDevice(environment: ProbeEnvironment = webProbeEnvironment): Promise<DeviceProbe> {
  const tiers: TierProbe[] = [];
  for (const quality of QUALITIES) {
    const frame = frameSize("video", quality);
    const config = await firstSupported(environment, frame, VIDEO_BITRATES[quality]);
    const previous = tiers.at(-1);
    const keptUp = previous === undefined || (previous.framesPerSecond ?? 0) / FPS >= REALTIME_FLOOR;
    const framesPerSecond = config !== null && keptUp ? await environment.timeFrames(frame, config) : null;
    tiers.push({ quality, isSupported: config !== null, framesPerSecond });
  }
  return { tiers };
}

/**
 * The render's order: H.264 on the hardware, then in software (never VP9); per encoder, the
 * quantizer configuration, then the constant bitrate.
 */
async function firstSupported(environment: ProbeEnvironment, frame: FrameSize, bitrate: number): Promise<VideoEncoderConfig | null> {
  for (const choice of VIDEO_CODECS) {
    for (const config of [quantizerEncoderConfig(choice, frame), videoEncoderConfig(choice, frame, bitrate)]) {
      if (await environment.isConfigSupported(config).catch(() => false)) return config;
    }
  }
  return null;
}

/** The frame options the render would pass: the governor's starting quantizer in quantizer mode. */
export function probeEncodeOptions(config: VideoEncoderConfig, isKeyFrame: boolean): VideoEncoderEncodeOptions {
  if (config.bitrateMode !== "quantizer") return { keyFrame: isKeyFrame };
  return { keyFrame: isKeyFrame, avc: { quantizer: QUANTIZER_SCALES.avc.start } };
}

/** True when `work` settles in `ms` (at least one event turn); false when the deadline wins. */
export async function withinDeadline(work: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), Math.max(0, ms));
  });
  try {
    return await Promise.race([work.then(() => true), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** The browser's: WebCodecs and an OffscreenCanvas in this worker. */
export const webProbeEnvironment: ProbeEnvironment = {
  async isConfigSupported(config) {
    if (typeof VideoEncoder === "undefined") return false;
    return (await VideoEncoder.isConfigSupported(config)).supported === true;
  },
  async timeFrames(frame, config) {
    const canvas = new OffscreenCanvas(frame.width, frame.height);
    const stage = createOfflineStage({ canvas, reducedMotion: false, keepOut: exportKeepOut() });
    if (stage === null) return null;
    let failed = false;
    const encoder = new VideoEncoder({ output: () => undefined, error: () => void (failed = true) });
    try {
      encoder.configure(config);
      stage.setProgram(probeProgram());
      stage.schedule(probeCues(), PROBE_TIMELINE);
      // The encoder's one-time start (about 2 s for Chrome's quantizer mode on the Mac, once
      // per browser session, measured) is not the device's pace: one frame first, untimed.
      stage.drawAt(0);
      const warmUp = new VideoFrame(canvas, { timestamp: 0, duration: 1_000_000 / FPS });
      encoder.encode(warmUp, probeEncodeOptions(config, true));
      warmUp.close();
      if (!(await withinDeadline(encoder.flush(), PROBE_TIER_DEADLINE_MS))) return null;
      const started = performance.now();
      let done = 0;
      while (done < PROBE_FRAMES && performance.now() - started < PROBE_TIER_DEADLINE_MS) {
        stage.drawAt(done / FPS);
        const picture = new VideoFrame(canvas, { timestamp: ((done + 1) * 1_000_000) / FPS, duration: 1_000_000 / FPS });
        encoder.encode(picture, probeEncodeOptions(config, false));
        picture.close();
        done += 1;
      }
      // An encoder that never flushes (Playwright's WebKit announces H.264 and delivers
      // nothing) must not hold Render on "Checking": past the deadline, untimed.
      const flushed = await withinDeadline(encoder.flush(), PROBE_TIER_DEADLINE_MS - (performance.now() - started));
      const seconds = (performance.now() - started) / 1000;
      return failed || !flushed || seconds <= 0 ? null : done / seconds;
    } catch {
      return null;
    } finally {
      if (encoder.state !== "closed") encoder.close();
      stage.destroy();
    }
  },
};
