// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// PCM WAV, 24-bit stereo, with the attribution in a LIST/INFO chunk after the data. The
// one WAV writer of the project: the export and the simulator (tools/sim) both use it.

export interface WavInfo {
  readonly comment: string;
  readonly software: string;
}

export const WAV_INFO: WavInfo = {
  comment: "Powered by Untzel · Techno Inspire · https://untzel.com",
  software: "Untzel",
};

export const WAV_MIME = "audio/wav";
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 3;
export const WAV_BYTES_PER_FRAME = CHANNELS * BYTES_PER_SAMPLE;
const HEADER_BYTES = 44;
const MAX_24 = 8_388_607;

/**
 * RIFF/WAVE header with a PCM 24-bit fmt chunk and the final size already known.
 * `trailingBytes`: chunks after `data` (infoChunk(WAV_INFO, title).length), counted in the RIFF size.
 */
export function wavHeader(frames: number, sampleRate: number, trailingBytes: number): Uint8Array {
  const dataBytes = frames * WAV_BYTES_PER_FRAME;
  const bytes = new Uint8Array(HEADER_BYTES);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  // frames × 6 is always even: the data chunk never needs a pad byte.
  view.setUint32(4, HEADER_BYTES - 8 + dataBytes + trailingBytes, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * WAV_BYTES_PER_FRAME, true);
  view.setUint16(32, WAV_BYTES_PER_FRAME, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, dataBytes, true);
  return bytes;
}

/** One planar block → interleaved PCM 24-bit; outside [-1, 1] clips, non-finite becomes 0. */
export function encodePcm24(left: Float32Array, right: Float32Array): Uint8Array {
  const frames = Math.min(left.length, right.length);
  const bytes = new Uint8Array(frames * WAV_BYTES_PER_FRAME);
  let offset = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    offset = writeSample(bytes, offset, left[frame] ?? 0);
    offset = writeSample(bytes, offset, right[frame] ?? 0);
  }
  return bytes;
}

/**
 * LIST/INFO with INAM (the song's title, when there is one), ICMT (comment) and ISFT
 * (software), UTF-8, every size even.
 */
export function infoChunk(info: WavInfo, songTitle: string | null): Uint8Array {
  const named = songTitle === null ? [] : [subChunk("INAM", songTitle)];
  const fields = [...named, subChunk("ICMT", info.comment), subChunk("ISFT", info.software)];
  const payload = 4 + fields.reduce((sum, field) => sum + field.length, 0);
  const bytes = new Uint8Array(8 + payload);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "LIST");
  view.setUint32(4, payload, true);
  writeAscii(bytes, 8, "INFO");
  let offset = 12;
  for (const field of fields) {
    bytes.set(field, offset);
    offset += field.length;
  }
  return bytes;
}

/** The whole file in memory, for short audio (the simulator). The export streams instead. */
export function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): Uint8Array {
  const info = infoChunk(WAV_INFO, null);
  const pcm = encodePcm24(left, right);
  const header = wavHeader(left.length, sampleRate, info.length);
  const bytes = new Uint8Array(header.length + pcm.length + info.length);
  bytes.set(header, 0);
  bytes.set(pcm, header.length);
  bytes.set(info, header.length + pcm.length);
  return bytes;
}

function subChunk(id: string, text: string): Uint8Array {
  const value = new TextEncoder().encode(`${text}\0`);
  const padded = value.length + (value.length % 2);
  const bytes = new Uint8Array(8 + padded);
  writeAscii(bytes, 0, id);
  new DataView(bytes.buffer).setUint32(4, value.length, true);
  bytes.set(value, 8);
  return bytes;
}

function writeSample(bytes: Uint8Array, offset: number, sample: number): number {
  const clipped = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
  const value = Math.round(clipped * MAX_24) & 0xffffff;
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  return offset + BYTES_PER_SAMPLE;
}

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
}
