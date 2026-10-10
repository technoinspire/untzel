// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The share link: the source text compressed in the URL fragment, then the
// sender's playback mode and play range as parameters (`&mode=song&range=9-28`
// and 0034). Received text is untrusted data; this module only ever returns a bounded
// string, a mode and a range, and the text's only consumer is analyze, which executes
// nothing.
import type { PlaybackMode, PlayRange, ShareLink } from "@untzel/session";
import { MAX_SOURCE_LENGTH } from "@untzel/session/limits";
import { decodeBase64url, encodeBase64url, isBase64url } from "./base64url";
import { deflateRaw, inflateBounded } from "./bounded-inflate";
import { playbackParams, readPlaybackParams } from "./playback-param";

export const LINK_PREFIX = "v1.";
/** Whole URL above this: the Share sheet offers a file (to be measured on devices). */
export const SAFE_LINK_LENGTH = 8_000;
/** At most 3 UTF-8 bytes per UTF-16 unit inside the language limit. */
export const MAX_SOURCE_BYTES = 3 * MAX_SOURCE_LENGTH; // 196 608
/**
 * base64url (no "=") of zlib's deflateBound(MAX_SOURCE_BYTES) with 64 B to spare:
 * B + (B >> 12) + (B >> 14) + 64 = 196 732 B → 262 310 characters. The real guard is
 * the byte counter during decompression.
 */
export const MAX_PAYLOAD_LENGTH = Math.ceil(
  ((MAX_SOURCE_BYTES + (MAX_SOURCE_BYTES >> 12) + (MAX_SOURCE_BYTES >> 14) + 64) * 4) / 3,
);
/** The parameters after the payload (`&mode=song&range=1000-1024&cycle=off` is 36): room for a few more, no more. */
export const MAX_PARAMS_LENGTH = 64;
const FRAGMENT = /^#v([1-9][0-9]{0,2})\.([^&]*)(.*)$/s;

export type LinkFailure = "UNKNOWN_VERSION" | "BAD_PAYLOAD" | "TOO_LARGE" | "CORRUPT" | "NOT_TEXT";

export type DecodedLink =
  | { readonly ok: true; readonly source: string; readonly mode: PlaybackMode | null; readonly range: PlayRange | null }
  | { readonly ok: false; readonly reason: LinkFailure };

/** `pageUrl` is location.origin + location.pathname; `mode` is left out when null, and `range` with it. */
export async function encodeLink(source: string, pageUrl: string, mode: PlaybackMode | null, range: PlayRange | null): Promise<ShareLink> {
  const payload = encodeBase64url(await deflateRaw(new TextEncoder().encode(source)));
  const params = playbackParams(mode, range).map((pair) => `&${pair}`).join("");
  const url = `${pageUrl}#${LINK_PREFIX}${payload}${params}`;
  if (url.length > SAFE_LINK_LENGTH) return { kind: "too-long", length: url.length };
  return { kind: "link", url, length: url.length };
}

/** `hash` is location.hash; null when it is not an Untzel link (plain anchors keep working). */
export async function decodeFragment(hash: string): Promise<DecodedLink | null> {
  const match = FRAGMENT.exec(hash);
  if (match === null) return null;
  if (match[1] !== "1") return failure("UNKNOWN_VERSION");
  const payload = match[2] ?? "";
  const params = match[3] ?? "";
  if (payload.length === 0 || payload.length > MAX_PAYLOAD_LENGTH || !isBase64url(payload)) {
    return failure("BAD_PAYLOAD");
  }
  if (params.length > MAX_PARAMS_LENGTH) return failure("BAD_PAYLOAD");
  // Older links have no parameters (null, and the receiver falls back);
  // links made before the range travelled have no range (null, and nothing changes).
  const { mode, range } = readPlaybackParams(params.split("&").slice(1));
  try {
    const inflated = await inflateBounded(decodeBase64url(payload), MAX_SOURCE_BYTES);
    if (!inflated.ok) return failure(inflated.reason);
    let source: string;
    try {
      source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(inflated.bytes);
    } catch {
      return failure("NOT_TEXT");
    }
    if (source.length > MAX_SOURCE_LENGTH) return failure("TOO_LARGE");
    return { ok: true, source, mode, range };
  } catch {
    return failure("CORRUPT");
  }
}

function failure(reason: LinkFailure): DecodedLink {
  return { ok: false, reason };
}
