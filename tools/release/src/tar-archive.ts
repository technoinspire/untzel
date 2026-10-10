// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Deterministic .tar.gz: POSIX ustar with regular files only, sorted, mode 0644,
// owner 0 with empty names, one fixed modification time, then gzip with the OS byte fixed.
// The same entries and time give the same bytes on any machine running the same Node.
import { gzipSync } from "node:zlib";
import { compareByPath } from "./path-order";

export interface ArchiveEntry {
  readonly path: string;
  readonly content: Uint8Array;
}

const BLOCK = 512;
const NAME_BYTES = 100;
const PREFIX_BYTES = 155;
const MAX_SIZE = 8 ** 11 - 1;
/** Byte 9 of the gzip header: 255 means "unknown", instead of the build machine's OS. */
const GZIP_OS_OFFSET = 9;
const GZIP_OS_UNKNOWN = 255;

/** The ustar name and prefix fields for a path, or an error when it cannot fit. */
export function splitTarPath(path: string): { readonly name: Buffer; readonly prefix: Buffer } {
  const bytes = Buffer.from(path, "utf8");
  if (bytes.length <= NAME_BYTES) return { name: bytes, prefix: Buffer.alloc(0) };
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0x2f) continue;
    const prefix = bytes.subarray(0, index);
    const name = bytes.subarray(index + 1);
    if (prefix.length <= PREFIX_BYTES && name.length > 0 && name.length <= NAME_BYTES) return { name, prefix };
  }
  throw new Error(`${path} does not fit a ustar header (name ${NAME_BYTES} bytes, prefix ${PREFIX_BYTES} bytes)`);
}

function writeOctal(header: Buffer, offset: number, width: number, value: number): void {
  header.write(`${value.toString(8).padStart(width - 1, "0")}\0`, offset, width, "ascii");
}

function tarHeader(path: string, size: number, mtimeSeconds: number): Buffer {
  if (size > MAX_SIZE) throw new Error(`${path} is larger than a ustar entry allows`);
  const { name, prefix } = splitTarPath(path);
  const header = Buffer.alloc(BLOCK);
  name.copy(header, 0);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, mtimeSeconds);
  header.write("0", 156, "ascii");
  header.write("ustar\0", 257, "ascii");
  header.write("00", 263, "ascii");
  writeOctal(header, 329, 8, 0);
  writeOctal(header, 337, 8, 0);
  prefix.copy(header, 345);
  header.fill(0x20, 148, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

export function createTar(entries: readonly ArchiveEntry[], mtimeSeconds: number): Buffer {
  if (!Number.isInteger(mtimeSeconds) || mtimeSeconds < 0) throw new Error(`invalid archive time ${mtimeSeconds}`);
  const blocks: Buffer[] = [];
  for (const entry of [...entries].sort(compareByPath)) {
    blocks.push(tarHeader(entry.path, entry.content.length, mtimeSeconds), Buffer.from(entry.content));
    const padding = (BLOCK - (entry.content.length % BLOCK)) % BLOCK;
    if (padding > 0) blocks.push(Buffer.alloc(padding));
  }
  blocks.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(blocks);
}

export function createTarGz(entries: readonly ArchiveEntry[], mtimeSeconds: number): Buffer {
  const archive = gzipSync(createTar(entries, mtimeSeconds), { level: 9 });
  archive[GZIP_OS_OFFSET] = GZIP_OS_UNKNOWN;
  return archive;
}
