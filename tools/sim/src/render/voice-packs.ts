// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The sample packs of the instruments, decoded for Node: the page decodes the
// Ogg Opus with decodeAudioData, Node has none, so the simulator demuxes the Ogg pages
// and decodes the packets with libopus compiled to WASM (opus-decoder, a dev
// dependency of this tool only). The decoded audio is cached in .cache/sim/voice-packs/
// by the checksum of the Opus file. The DSP tables come from the same samplePackData
// the page uses.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPackManifest, samplePackData, type SamplePackData } from "@untzel/audio/protocol";
import { OpusDecoder } from "opus-decoder";
import { simRegistry } from "../registry";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const PACK_DIR = join("samples", "v1");
const CACHE_DIR = join(REPO, ".cache", "sim", "voice-packs");
const OGG_HEADER = 27;

export interface OggOpus {
  readonly preSkip: number;
  /** Granule position of the last page: pre-skip plus the frames of the stream. */
  readonly lastGranule: number;
  readonly packets: Uint8Array[];
}

/** The Opus packets of an Ogg stream (RFC 7845), without the two header packets. */
export function oggOpusPackets(bytes: Uint8Array): OggOpus {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packets: Uint8Array[] = [];
  let pending: Uint8Array[] = [];
  let lastGranule = 0;
  for (let offset = 0; offset + OGG_HEADER <= bytes.length; ) {
    if (view.getUint32(offset, false) !== 0x4f676753) throw new Error(`no Ogg page at byte ${offset}`);
    const granule = Number(view.getBigInt64(offset + 6, true));
    const segments = bytes[offset + 26] ?? 0;
    let body = offset + OGG_HEADER + segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const size = bytes[offset + OGG_HEADER + segment] ?? 0;
      pending.push(bytes.subarray(body, body + size));
      body += size;
      if (size < 255) {
        packets.push(concat(pending));
        pending = [];
      }
    }
    if (granule >= 0) lastGranule = granule;
    offset = body;
  }
  const head = packets[0];
  if (head === undefined || new TextDecoder().decode(head.subarray(0, 8)) !== "OpusHead") throw new Error("not an Ogg Opus stream");
  const preSkip = (head[10] ?? 0) | ((head[11] ?? 0) << 8);
  return { preSkip, lastGranule, packets: packets.slice(2) };
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  if (parts.length === 1 && parts[0] !== undefined) return parts[0];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Mono 48 kHz samples of an Ogg Opus file, pre-skip and end trimmed as decoders do. */
export async function decodeOggOpus(bytes: Uint8Array): Promise<Float32Array> {
  const { preSkip, lastGranule, packets } = oggOpusPackets(bytes);
  const decoder = new OpusDecoder({ channels: 1, preSkip });
  await decoder.ready;
  try {
    const decoded = decoder.decodeFrames(packets);
    if (decoded.errors.length > 0) throw new Error(`opus: ${decoded.errors.length} decode errors`);
    const samples = decoded.channelData[0] ?? new Float32Array(0);
    return samples.slice(0, Math.max(0, lastGranule - preSkip));
  } finally {
    decoder.free();
  }
}

async function decodedPcm(opus: Uint8Array): Promise<Float32Array> {
  const key = createHash("sha256").update(opus).digest("hex");
  const cached = join(CACHE_DIR, `${key}.f32`);
  if (existsSync(cached)) {
    const raw = readFileSync(cached);
    return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  }
  const pcm = await decodeOggOpus(opus);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cached, new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  return pcm;
}

/** Every instrument with `samples/v1/pack.json`, decoded, by instrumentId of the registry. */
export async function loadVoicePacks(repo: string = REPO): Promise<SamplePackData[]> {
  const names = simRegistry().instruments.map((manifest) => manifest.name);
  const packs: SamplePackData[] = [];
  for (const instrument of readdirSync(join(repo, "instruments")).sort()) {
    const dir = join(repo, "instruments", instrument, PACK_DIR);
    if (!existsSync(join(dir, "pack.json"))) continue;
    const read = readPackManifest(JSON.parse(readFileSync(join(dir, "pack.json"), "utf8")));
    if (!read.ok) throw new Error(`${instrument}: ${read.reason}`);
    const pcm = await decodedPcm(readFileSync(join(dir, "pack.opus")));
    const pack = samplePackData(read.manifest, names.indexOf(instrument), pcm);
    if (pack === null) throw new Error(`${instrument}: decoded ${pcm.length} frames, the pack has ${read.manifest.frames}`);
    packs.push(pack);
  }
  return packs;
}

/** Loaded once per process: the simulator renders with the packs, as the page does once they arrive. */
export const VOICE_PACKS: readonly SamplePackData[] = await loadVoicePacks();
