// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Worker only: the render's preferred encoder started ahead of the first frame.
// Browser-bound like the codec probe; nothing here decides anything.
import { QUANTIZER_SCALES } from "./bitrate-governor";
import { h264Choice, PROBE_DEADLINE_MS, quantizerEncoderConfig, withDeadline } from "../codecs/codecs";
import type { FrameSize } from "../probe/tiers";

/**
 * Starts the encoder the render prefers (H.264 on the hardware, a quantizer per frame) on
 * one frame of `frame`'s size. Its one-time start, about 2 s in Chrome on the Mac and once
 * per browser session (measured), then overlaps the codec probe and the
 * sound's setup instead of delaying the first frame. True when it encoded: the codec probe
 * counts that as hardware H.264 working (codec-probe.ts). False when refused or past the
 * deadline; harmless.
 */
export async function warmUpVideoEncoder(frame: FrameSize, deadlineMs: number = PROBE_DEADLINE_MS): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  const config = quantizerEncoderConfig(h264Choice("prefer-hardware"), frame);
  const encoder = new VideoEncoder({ output: () => undefined, error: () => undefined });
  try {
    if (!(await VideoEncoder.isConfigSupported(config)).supported) return false;
    encoder.configure(config);
    const frameData = new VideoFrame(new Uint8Array(frame.width * frame.height * 4), { format: "RGBA", codedWidth: frame.width, codedHeight: frame.height, timestamp: 0 });
    encoder.encode(frameData, { keyFrame: true, avc: { quantizer: QUANTIZER_SCALES.avc.start } });
    frameData.close();
    return await withDeadline(encoder.flush().then(() => true), deadlineMs);
  } catch {
    return false;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
}
