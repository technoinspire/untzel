// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { PositionedBlobParts } from "./blob-target";

const bytes = (...values: number[]) => new Uint8Array(values);
const read = async (parts: PositionedBlobParts) => [...new Uint8Array(await parts.toBlob("video/mp4").arrayBuffer())];

describe("PositionedBlobParts", () => {
  it("appends writes in file order", async () => {
    const parts = new PositionedBlobParts();
    parts.write(bytes(1, 2), 0);
    parts.write(bytes(3, 4, 5), 2);
    expect(parts.size).toBe(5);
    expect(await read(parts)).toEqual([1, 2, 3, 4, 5]);
    expect(parts.toBlob("video/mp4").type).toBe("video/mp4");
  });

  it("fills a gap with zeros", async () => {
    const parts = new PositionedBlobParts();
    parts.write(bytes(1), 0);
    parts.write(bytes(9), 3);
    expect(await read(parts)).toEqual([1, 0, 0, 9]);
  });

  it("patches a reserved header over earlier parts, cutting them where they meet", async () => {
    // ftyp, a reserved zero region, then the mdat; the moov and a size patched at the end.
    const parts = new PositionedBlobParts();
    parts.write(bytes(7, 7), 0);
    parts.write(new Uint8Array(6), 2);
    parts.write(bytes(8, 8, 8), 8);
    parts.write(bytes(5, 5, 5, 5), 3);
    parts.write(bytes(6), 8);
    expect(parts.size).toBe(11);
    expect(await read(parts)).toEqual([7, 7, 0, 5, 5, 5, 5, 0, 6, 8, 8]);
  });

  it("an overwrite that runs past the end grows the file", async () => {
    const parts = new PositionedBlobParts();
    parts.write(bytes(1, 2, 3), 0);
    parts.write(bytes(4, 5, 6), 2);
    expect(await read(parts)).toEqual([1, 2, 4, 5, 6]);
  });
});
