// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Text that arrives from outside: a link in the address bar or a file. In the initial JS
// for the link (decodeFragment only); analyze, the session and the autosave are injected
// when the engine loads, so this module imports types and the share decoders only.
import type { AnalyzeResult } from "@untzel/language";
import type { PlaybackMode, PlayRange, PlayRanges, Session } from "@untzel/session";
import { carriedRange, openingMode } from "@untzel/session/opening-mode";
import { decodeFragment, type DecodedLink } from "@untzel/share/link";
import type { ReadFile } from "@untzel/share/untzel-file";
import { announcements } from "../../strings/copy";
import type { Autosave } from "../autosave";

export type ReceivedOrigin = "link" | "file";

export interface ReceivedDependencies {
  readonly analyze: (source: string) => AnalyzeResult;
  readonly session: Pick<Session, "applyText" | "setMode">;
  /** The play range the link or the file carries goes to its mode. */
  readonly ranges: Pick<PlayRanges, "receive">;
  readonly autosave: Pick<Autosave, "rebase">;
  readonly announce: (message: string) => void;
  /** A link becomes "Remix of <title>"; a file keeps its own title. */
  readonly retitle: (source: string, origin: ReceivedOrigin) => string;
}

/** What arrived: the text, and the sender's mode and play range when the link or the file carries them. */
export interface Received {
  readonly source: string;
  readonly mode: PlaybackMode | null;
  /** The range of `mode`; null without one. */
  readonly range: PlayRange | null;
  readonly origin: ReceivedOrigin;
  /** The file's format version; null for a link. */
  readonly formatVersion: number | null;
}

/**
 * While the music plays: analyze before anything. Invalid text changes nothing (not the
 * text, not the mode, not the saved session); valid text becomes the new starting point
 * and plays on the next bar, the previous text kept in undo, in the mode it opens in: a
 * mode change enters on the next 4-bar phrase, as the Loop / Song selector. A range that
 * came with it enters on the next bar; without one, the range stays.
 */
export function applyReceived(received: Received, label: string, dependencies: ReceivedDependencies): "applied" | "rejected" {
  const { source, origin, formatVersion } = received;
  const result = dependencies.analyze(source);
  if (!result.ok) {
    console.info("received: invalid text");
    dependencies.announce(rejection(origin, result, formatVersion));
    return "rejected";
  }
  const titled = dependencies.retitle(source, origin);
  dependencies.autosave.rebase(titled);
  dependencies.session.applyText(titled);
  // Always set: the same mode as the one sounding also drops a change still pending.
  dependencies.session.setMode(openingMode(received.mode, result.program));
  dependencies.ranges.receive(carriedRange(received.mode, received.range));
  dependencies.announce(announcements.receivedPlays(label));
  return "applied";
}

/** The message for text that does not analyze, by where it came from. */
export function rejection(
  origin: ReceivedOrigin,
  result: Extract<AnalyzeResult, { readonly ok: false }>,
  formatVersion: number | null,
): string {
  if (origin === "link") return announcements.linkFailed;
  if (formatVersion !== null && formatVersion > 1) return announcements.fileNeedsNewer;
  return announcements.fileHasErrors(result.diagnostics[0]?.message ?? "");
}

/** The message for a file that could not be read as text. */
export function fileFailure(reason: Extract<ReadFile, { readonly ok: false }>["reason"]): string {
  return reason === "TOO_LARGE" ? announcements.fileTooLarge : announcements.fileNotSong;
}

/**
 * Reads an Untzel link from the address bar and takes the fragment out of it:
 * the music stays, the URL goes back to the page address. Null when the hash is not a link.
 */
export async function readAddressLink(location: Location, history: History): Promise<DecodedLink | null> {
  let decoded: DecodedLink | null;
  try {
    decoded = await decodeFragment(location.hash);
  } catch {
    decoded = { ok: false, reason: "CORRUPT" };
  }
  if (decoded === null) return null;
  history.replaceState(history.state, "", location.pathname + location.search);
  if (!decoded.ok) console.info(`link: ${decoded.reason}`);
  return decoded;
}
