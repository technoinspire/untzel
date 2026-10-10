// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// base64url without "=" padding (RFC 4648, section 5), written out so the link format
// does not depend on Uint8Array.fromBase64, which not every engine has.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const VALID = /^[A-Za-z0-9_-]*$/;
const VALUES = new Map([...ALPHABET].map((character, index) => [character, index]));

export function encodeBase64url(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    const remaining = bytes.length - index;
    text += ALPHABET[(triple >> 18) & 63] ?? "";
    text += ALPHABET[(triple >> 12) & 63] ?? "";
    if (remaining > 1) text += ALPHABET[(triple >> 6) & 63] ?? "";
    if (remaining > 2) text += ALPHABET[triple & 63] ?? "";
  }
  return text;
}

/** True when `text` can be base64url without padding: the alphabet, and length % 4 ≠ 1. */
export function isBase64url(text: string): boolean {
  return VALID.test(text) && text.length % 4 !== 1;
}

/** Caller checks isBase64url first. */
export function decodeBase64url(text: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let written = 0;
  for (let index = 0; index < text.length; index += 4) {
    const values = [0, 1, 2, 3].map((offset) => VALUES.get(text[index + offset] ?? "") ?? 0);
    const quad =
      ((values[0] ?? 0) << 18) | ((values[1] ?? 0) << 12) | ((values[2] ?? 0) << 6) | (values[3] ?? 0);
    const count = Math.min(3, text.length - index - 1);
    if (count >= 1) bytes[written++] = (quad >> 16) & 255;
    if (count >= 2) bytes[written++] = (quad >> 8) & 255;
    if (count >= 3) bytes[written++] = quad & 255;
  }
  return bytes.subarray(0, written);
}
