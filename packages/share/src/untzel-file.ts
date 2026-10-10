// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The .untzel file: the source text in UTF-8 after a format line. The format line is not
// part of the text: it is added on save and removed on open, so it never accumulates and
// never reaches the editor. The line also carries the sender's playback mode and play
// range (`// untzel 1 mode=song range=9-28 cycle=off`): beside the
// text, never in it.
import type { PlaybackMode, PlayRange } from "@untzel/session";
import { MAX_SOURCE_LENGTH } from "@untzel/session/limits";
import { MAX_SOURCE_BYTES } from "./link";
import { playbackParams, readPlaybackParams } from "./playback-param";

const FORMAT_VERSION = 1;
/** The format line without parameters, as older files have it. */
export const FORMAT_LINE = formatLine(null, null);
export const UNTZEL_EXTENSION = ".untzel";
export const UNTZEL_MIME = "text/x-untzel";
/** Text at the limit + optional BOM + a format line of up to 64 B (`… mode=song range=1000-1024 cycle=off` is 48 with its newline). */
export const MAX_FILE_BYTES = MAX_SOURCE_BYTES + 3 + 64;
const VERSION_LINE = /^\/\/ untzel (\d+)((?: [a-z]{1,16}=[a-z0-9-]{1,16}){0,4})\r?\n/;
const BOM = "\uFEFF";

export type FileFailure = "TOO_LARGE" | "NOT_TEXT" | "EMPTY";
export type ReadFile =
  | {
      readonly ok: true;
      readonly source: string;
      readonly formatVersion: number | null;
      readonly mode: PlaybackMode | null;
      readonly range: PlayRange | null;
    }
  | { readonly ok: false; readonly reason: FileFailure };

/** The format line + source. The source never starts with the line: readUntzelFile removed it. */
export function untzelFileText(source: string, mode: PlaybackMode | null, range: PlayRange | null): string {
  return formatLine(mode, range) + source;
}

function formatLine(mode: PlaybackMode | null, range: PlayRange | null): string {
  const params = playbackParams(mode, range).map((pair) => ` ${pair}`).join("");
  return `// untzel ${FORMAT_VERSION}${params}\n`;
}

/**
 * `<baseName>.untzel` (the title's slug, made safe by the caller), or
 * untzel-YYYYMMDD-HHMM.untzel in local time when there is none.
 */
export function untzelFileName(baseName: string | null, now: Date): string {
  if (baseName !== null && baseName !== "") return `${baseName}${UNTZEL_EXTENSION}`;
  return `untzel-${timestamp(now)}${UNTZEL_EXTENSION}`;
}

/** YYYYMMDD-HHMM in local time, shared by every file name the app writes. */
export function timestamp(now: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`;
  return `${date}-${two(now.getHours())}${two(now.getMinutes())}`;
}

/** Size is checked before reading; decoding is strict UTF-8. */
export async function readUntzelFile(file: Blob): Promise<ReadFile> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "TOO_LARGE" };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
  } catch {
    return { ok: false, reason: "NOT_TEXT" };
  }
  if (text.startsWith(BOM)) text = text.slice(BOM.length);
  const versionLine = VERSION_LINE.exec(text);
  const formatVersion = versionLine === null ? null : Number(versionLine[1]);
  // Files without the line or without parameters: null, and the receiver falls back.
  const { mode, range } = readPlaybackParams((versionLine?.[2] ?? "").split(" ").slice(1));
  if (versionLine !== null) text = text.slice(versionLine[0].length);
  const source = text.replaceAll("\r\n", "\n");
  if (source.length > MAX_SOURCE_LENGTH) return { ok: false, reason: "TOO_LARGE" };
  if (source.length === 0) return { ok: false, reason: "EMPTY" };
  return { ok: true, source, formatVersion, mode, range };
}

/** The first dropped or picked file that can be a song: ".untzel" or any text/* type. */
export function isUntzelCandidate(file: { readonly name: string; readonly type: string }): boolean {
  return file.name.toLowerCase().endsWith(UNTZEL_EXTENSION) || file.type.startsWith("text/");
}
