// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { tailLength } from "./render-wav";
import { WAV_INFO, encodePcm24, encodeWav, infoChunk, wavHeader } from "./wav";

const ascii = (bytes: Uint8Array, from: number, length: number) => String.fromCharCode(...bytes.subarray(from, from + length));

describe("WAV", () => {
  it("writes a PCM 24-bit 48 kHz stereo header with the final sizes", () => {
    const header = wavHeader(1_000, 48_000, 64);
    const view = new DataView(header.buffer);
    expect(header.length).toBe(44);
    expect(ascii(header, 0, 4)).toBe("RIFF");
    expect(ascii(header, 8, 8)).toBe("WAVEfmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint32(28, true)).toBe(48_000 * 6);
    expect(view.getUint16(32, true)).toBe(6);
    expect(view.getUint16(34, true)).toBe(24);
    expect(ascii(header, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(6_000);
    expect(view.getUint32(4, true)).toBe(44 - 8 + 6_000 + 64);
  });

  it("has RIFF size = file size − 8 with the INFO chunk after the data", () => {
    const bytes = encodeWav(new Float32Array(3), new Float32Array(3), 48_000);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
    expect(ascii(bytes, 44 + 18, 4)).toBe("LIST");
    expect(ascii(bytes, 44 + 18 + 8, 4)).toBe("INFO");
  });

  it("writes LIST/INFO with ICMT and ISFT in UTF-8, every size even", () => {
    const info = infoChunk(WAV_INFO, null);
    const view = new DataView(info.buffer);
    expect(info.length % 2).toBe(0);
    expect(view.getUint32(4, true)).toBe(info.length - 8);
    const text = new TextDecoder().decode(info);
    expect(text).toContain("ICMT");
    expect(text).toContain("Powered by Untzel · Techno Inspire · https://untzel.com");
    expect(text).toContain("ISFT");
    let offset = 12;
    while (offset < info.length) {
      const size = view.getUint32(offset + 4, true);
      offset += 8 + size + (size % 2);
    }
    expect(offset).toBe(info.length);
  });

  it("names the song in INAM first, when it has a title", () => {
    const info = infoChunk(WAV_INFO, "Ação à Noite");
    const view = new DataView(info.buffer);
    expect(ascii(info, 12, 4)).toBe("INAM");
    expect(new TextDecoder().decode(info)).toContain("Ação à Noite");
    expect(info.length % 2).toBe(0);
    expect(view.getUint32(4, true)).toBe(info.length - 8);
    expect(new TextDecoder().decode(infoChunk(WAV_INFO, null))).not.toContain("INAM");
  });
  it("interleaves, clips and zeroes non-finite samples", () => {
    const pcm = encodePcm24(new Float32Array([1, 2, Number.NaN]), new Float32Array([-1, -2, Number.POSITIVE_INFINITY]));
    expect([...pcm.subarray(0, 6)]).toEqual([0xff, 0xff, 0x7f, 0x01, 0x00, 0x80]);
    expect([...pcm.subarray(6, 12)]).toEqual([0xff, 0xff, 0x7f, 0x01, 0x00, 0x80]);
    expect([...pcm.subarray(12, 18)]).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe("audio tail", () => {
  it("ends where 250 ms of silence below −80 dBFS begin, or at its full length", () => {
    const left = new Float32Array(48_000);
    const right = new Float32Array(48_000);
    left.fill(0.5, 0, 1_000);
    right[3_000] = 0.001;
    expect(tailLength({ left, right }, 12_000)).toBe(3_001);
    const loud = new Float32Array(20_000).fill(0.1);
    expect(tailLength({ left: loud, right: loud }, 12_000)).toBe(20_000);
    expect(tailLength({ left: new Float32Array(20_000), right: new Float32Array(20_000) }, 12_000)).toBe(0);
  });
});
