// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// How many packets each MP4 track may carry, known before the render: the muxer reserves
// room for the moov at the start of the file from these counts (fastStart "reserve"), so
// the file keeps the moov before the mdat without being held whole in memory.
// Pure.
import { SAMPLES_PER_VIDEO_FRAME, type ExportPlan } from "../plan";

/**
 * The shortest audio packet assumed: 10 ms at 48 kHz, Mediabunny's guidance for any audio
 * codec. AAC packs 1 024 samples and Opus 960 at its default 20 ms, so this is at least
 * twice the real count.
 */
const SHORTEST_AUDIO_PACKET_SAMPLES = 480;
/** The encoder's priming and its last partial packet. */
const AUDIO_EXTRA_PACKETS = 64;

export interface PacketBudget {
  /** One packet per frame: WebCodecs emits one chunk per encoded frame. */
  readonly video: number;
  readonly audio: number;
}

export function packetBudget(plan: Pick<ExportPlan, "totalVideoFrames">): PacketBudget {
  const audioSamples = plan.totalVideoFrames * SAMPLES_PER_VIDEO_FRAME;
  return {
    video: plan.totalVideoFrames,
    audio: Math.ceil(audioSamples / SHORTEST_AUDIO_PACKET_SAMPLES) + AUDIO_EXTRA_PACKETS,
  };
}
