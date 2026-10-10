// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// deflate-raw with a byte counter in the stream: a decompression bomb is cancelled one
// block after the limit, long before it is decompressed.

export type InflateResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly reason: "TOO_LARGE" | "CORRUPT"; readonly read: number };

export async function inflateBounded(compressed: Uint8Array, maxBytes: number): Promise<InflateResult> {
  const input = new Blob([compressed as Uint8Array<ArrayBuffer>]).stream();
  const reader = input.pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let read = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.byteLength;
      if (read > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "TOO_LARGE", read };
      }
      chunks.push(value);
    }
  } catch {
    // Truncated input, garbage after the end, or invalid deflate: every engine rejects.
    return { ok: false, reason: "CORRUPT", read };
  }
  const bytes = new Uint8Array(read);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

export async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
