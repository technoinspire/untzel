// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// AAC encoders put priming samples before the music, and the MP4 does not compensate:
// measured 1 024 to 3 088 samples depending on the browser, so the delay is measured at
// run time. An impulse at sample 0 goes through the same encoder and back through a
// decoder; where its peak lands is the delay, and each AudioSample is stamped that much
// earlier.
import { audioEncoderConfig, type AudioCodecChoice } from "../codecs/codecs";
import { SAMPLE_RATE } from "../plan";

const PROBE_FRAMES = SAMPLE_RATE / 5;

/** Index of the largest magnitude; the first one on ties. */
export function findPeak(samples: Float32Array): number {
  let peak = 0;
  let best = -1;
  for (let index = 0; index < samples.length; index += 1) {
    const magnitude = Math.abs(samples[index] ?? 0);
    if (magnitude > best) {
      best = magnitude;
      peak = index;
    }
  }
  return peak;
}

/** The round trip gets this long; a codec that never flushes counts as not measured. */
export const PRIMING_DEADLINE_MS = 3_000;

/**
 * Encoder delay in samples, or null when the round trip fails or does not finish in
 * time (the caller uses 0 and warns).
 */
export function measureEncoderDelay(choice: AudioCodecChoice, deadlineMs = PRIMING_DEADLINE_MS): Promise<number | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), deadlineMs);
    roundTrip(choice).then(
      (delay) => {
        clearTimeout(timer);
        resolve(delay);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

// Over 40 lines: one encoder and decoder round trip; the codec objects, their callbacks and the cleanup share one try.
async function roundTrip(choice: AudioCodecChoice): Promise<number | null> {
  if (typeof AudioEncoder === "undefined" || typeof AudioDecoder === "undefined") return null;
  const chunks: EncodedAudioChunk[] = [];
  let decoderConfig: AudioDecoderConfig | null = null;
  let failed = false;
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      chunks.push(chunk);
      decoderConfig ??= metadata?.decoderConfig ?? null;
    },
    error: () => void (failed = true),
  });
  const decoded: Float32Array[] = [];
  const decoder = new AudioDecoder({
    output: (data) => {
      const channel = new Float32Array(data.numberOfFrames);
      data.copyTo(channel, { planeIndex: 0, format: "f32-planar" });
      decoded.push(channel);
      data.close();
    },
    error: () => void (failed = true),
  });
  try {
    encoder.configure(audioEncoderConfig(choice));
    const left = new Float32Array(PROBE_FRAMES);
    left[0] = 0.9;
    const planar = new Float32Array(PROBE_FRAMES * 2);
    planar.set(left, 0);
    planar.set(left, PROBE_FRAMES);
    const data = new AudioData({
      format: "f32-planar",
      sampleRate: SAMPLE_RATE,
      numberOfFrames: PROBE_FRAMES,
      numberOfChannels: 2,
      timestamp: 0,
      data: planar,
    });
    encoder.encode(data);
    data.close();
    await encoder.flush();
    const config: AudioDecoderConfig | null = decoderConfig;
    if (failed || config === null) return null;
    decoder.configure(config);
    for (const chunk of chunks) decoder.decode(chunk);
    await decoder.flush();
    if (failed || decoded.length === 0) return null;
    const total = decoded.reduce((sum, part) => sum + part.length, 0);
    const joined = new Float32Array(total);
    let offset = 0;
    for (const part of decoded) {
      joined.set(part, offset);
      offset += part.length;
    }
    return findPeak(joined);
  } catch {
    return null;
  } finally {
    if (encoder.state !== "closed") encoder.close();
    if (decoder.state !== "closed") decoder.close();
  }
}
