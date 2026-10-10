// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The MP4 file as Blob parts, written while it renders. Mediabunny's
// public StreamTarget hands over positioned writes; each one becomes a Blob part at once,
// so no contiguous buffer of the whole file is ever held in the worker. A write that lands
// before the end (the moov and the mdat size patched into the reserved header when the
// muxer finalizes) replaces those bytes by slicing the parts around it, which copies
// nothing. The finished file is one Blob over the parts.
import { StreamTarget, type StreamTargetChunk } from "mediabunny";

/** StreamTarget's chunk size here: at most two such chunks wait in memory before they become parts. */
export const BLOB_TARGET_CHUNK_BYTES = 8 * 1024 * 1024;

interface Part {
  readonly start: number;
  readonly blob: Blob;
}

/** Bytes at positions, kept as Blob parts in file order; later writes win where they overlap. */
export class PositionedBlobParts {
  #parts: Part[] = [];
  #size = 0;

  get size(): number {
    return this.#size;
  }

  write(data: Uint8Array<ArrayBuffer>, position: number): void {
    if (position > this.#size) this.#append(new Blob([new Uint8Array(position - this.#size)]));
    const blob = new Blob([data]);
    if (position === this.#size) return this.#append(blob);
    this.#overwrite(blob, position);
  }

  toBlob(type: string): Blob {
    return new Blob(
      this.#parts.map((part) => part.blob),
      { type },
    );
  }

  #append(blob: Blob): void {
    this.#parts.push({ start: this.#size, blob });
    this.#size += blob.size;
  }

  /** The parts before `position`, the new bytes, then the parts after them, each cut where they meet. */
  #overwrite(blob: Blob, position: number): void {
    const end = position + blob.size;
    const parts: Part[] = [];
    for (const part of this.#parts) {
      const partEnd = part.start + part.blob.size;
      if (partEnd <= position || part.start >= end) {
        parts.push(part);
        continue;
      }
      if (part.start < position) parts.push({ start: part.start, blob: part.blob.slice(0, position - part.start) });
      if (partEnd > end) parts.push({ start: end, blob: part.blob.slice(end - part.start) });
    }
    parts.push({ start: position, blob });
    parts.sort((a, b) => a.start - b.start);
    this.#parts = parts;
    this.#size = Math.max(this.#size, end);
  }
}

/** A StreamTarget whose writes become Blob parts; `toBlob` after the output is finalized. */
export function createBlobTarget(): { readonly target: StreamTarget; toBlob(type: string): Blob } {
  const parts = new PositionedBlobParts();
  const writable = new WritableStream<StreamTargetChunk>({
    write: (chunk) => parts.write(chunk.data, chunk.position),
  });
  return {
    target: new StreamTarget(writable, { chunked: true, chunkSize: BLOB_TARGET_CHUNK_BYTES }),
    toBlob: (type) => parts.toBlob(type),
  };
}
