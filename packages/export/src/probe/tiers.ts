// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's quality tiers and which ones a device is offered. Pure: the
// frame sizes, the bitrates and the choice from a device probe are tested without a
// browser. HD is the floor and is always offered; 4K only where the probe passed at about
// real time. Nothing here lowers a quality: a tier that does not fit is refused upstream.

export type ExportQuality = "hd" | "4k";
export type VideoFormat = "story" | "video";
export const QUALITIES: readonly ExportQuality[] = ["hd", "4k"];
/** Every picture format; tiers.test.ts holds it to the VideoFormat union, so none is left out of the brand zones. */
export const VIDEO_FORMATS: readonly VideoFormat[] = ["story", "video"];

export interface FrameSize {
  readonly width: number;
  readonly height: number;
}

/** The shorter side of each tier; the longer side follows the format's ratio. */
const SHORT_SIDE: Readonly<Record<ExportQuality, number>> = { hd: 1080, "4k": 2160 };
const LONG_SIDE: Readonly<Record<ExportQuality, number>> = { hd: 1920, "4k": 3840 };
/**
 * The rate control's video target per tier, every video format alike. 4K is 30 Mbit/s,
 * not 35: measured, Chrome's encoder spends about 30 at the finest quantizer on full
 * light, and the file must not promise a rate it does not reach.
 */
export const VIDEO_BITRATES: Readonly<Record<ExportQuality, number>> = { hd: 12_000_000, "4k": 30_000_000 };
export const AAC_BITRATE = 320_000;
/** The longest file a tier is offered for, video and sound. */
export const MAX_VIDEO_BYTES = 1_000_000_000;
/** "About 1× real time": the probe may run this much slower and still pass. */
export const REALTIME_FLOOR = 0.9;
const VIDEO_FPS = 30;

export function frameSize(format: VideoFormat, quality: ExportQuality): FrameSize {
  const short = SHORT_SIDE[quality];
  const long = LONG_SIDE[quality];
  switch (format) {
    case "story":
      return { width: short, height: long };
    case "video":
      return { width: long, height: short };
  }
}

/** Seconds of video a tier may last within MAX_VIDEO_BYTES, sound included. */
export function maxSecondsFor(quality: ExportQuality): number {
  return Math.floor((MAX_VIDEO_BYTES * 8) / (VIDEO_BITRATES[quality] + AAC_BITRATE));
}

/** What the probe measured for one tier, on the 16:9 frame (the most pixels of the tier). */
export interface TierProbe {
  readonly quality: ExportQuality;
  /** VideoEncoder.isConfigSupported accepted the final configuration. */
  readonly isSupported: boolean;
  /** Frames drawn and encoded per second; null when not timed. */
  readonly framesPerSecond: number | null;
}

export interface DeviceProbe {
  readonly tiers: readonly TierProbe[];
}

export interface TierOffer {
  readonly quality: ExportQuality;
  /** framesPerSecond / 30; null before the device was probed. */
  readonly realtimeFactor: number | null;
  readonly isRealtime: boolean;
}

export interface TierChoice {
  /** HD first; 4K before the first probe, then only where it passed. */
  readonly offers: readonly TierOffer[];
  readonly defaultQuality: ExportQuality;
  /** False until this device has been probed: no estimate yet. */
  readonly isProbed: boolean;
}

export function chooseTiers(probe: DeviceProbe | null): TierChoice {
  if (probe === null) {
    // Before the first probe both tiers are offered at once: the person
    // picks, Render probes, and a device that cannot take 4K renders HD (export-jobs.ts).
    return {
      offers: [
        { quality: "hd", realtimeFactor: null, isRealtime: false },
        { quality: "4k", realtimeFactor: null, isRealtime: false },
      ],
      defaultQuality: "hd",
      isProbed: false,
    };
  }
  const offers = QUALITIES.map((quality) => offerOf(probe, quality)).filter(
    (offer) => offer.quality === "hd" || (isSupported(probe, offer.quality) && offer.isRealtime),
  );
  const realtime = offers.filter((offer) => offer.isRealtime);
  return { offers, defaultQuality: realtime.at(-1)?.quality ?? "hd", isProbed: true };
}

/**
 * A device probe worth keeping: H.264 accepted at HD, and a pace for every tier the probe
 * had to time (4K only after an HD at about real time). A tier left untimed by a deadline
 * on a busy machine is not an answer: the probe is not kept and the next Render probes again.
 */
export function isCompleteProbe(probe: DeviceProbe): boolean {
  let previousKeptUp = true;
  for (const quality of QUALITIES) {
    const tier = probe.tiers.find((candidate) => candidate.quality === quality);
    if (tier === undefined || (quality === "hd" && !tier.isSupported)) return false;
    if (tier.isSupported && previousKeptUp && tier.framesPerSecond === null) return false;
    previousKeptUp = tier.framesPerSecond !== null && tier.framesPerSecond / VIDEO_FPS >= REALTIME_FLOOR;
  }
  return true;
}

/**
 * The one-time start of the H.264 encoder in quantizer mode, once per browser session:
 * measured 1.99–2.09 s to the first frame in Chrome on the Mac, against 45 ms at a
 * constant bitrate.
 */
export const ENCODER_START_SECONDS = 2;

/**
 * Seconds a render of `videoFrames` frames should take at this offer's measured pace,
 * plus the encoder's start while no encoder has run on this page. No extra margin:
 * measured, a whole render (sound, mark and muxer included) ran at 0.6–0.9 of the pace,
 * because the probe times a cold encoder.
 */
export function estimateRenderSeconds(videoFrames: number, offer: TierOffer, isEncoderStarted: boolean): number | null {
  if (offer.realtimeFactor === null || offer.realtimeFactor <= 0) return null;
  return videoFrames / (offer.realtimeFactor * VIDEO_FPS) + (isEncoderStarted ? 0 : ENCODER_START_SECONDS);
}

function offerOf(probe: DeviceProbe, quality: ExportQuality): TierOffer {
  const measured = probe.tiers.find((tier) => tier.quality === quality)?.framesPerSecond ?? null;
  const realtimeFactor = measured === null ? null : measured / VIDEO_FPS;
  return { quality, realtimeFactor, isRealtime: realtimeFactor !== null && realtimeFactor >= REALTIME_FLOOR };
}

function isSupported(probe: DeviceProbe, quality: ExportQuality): boolean {
  return probe.tiers.some((tier) => tier.quality === quality && tier.isSupported);
}
