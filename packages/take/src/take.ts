// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A take: the transport's inputs over a performance, each with the receipt the
// transport gave it. The video and the WAV are a replay of these inputs, never pixels nor
// the browser's audio.
import type { Program } from "@untzel/core";
import type { PlaybackMode, PlayRangeChange } from "@untzel/session";

/** The budget marker of the take chunks and the file's format field. */
export const TAKE_FORMAT = "untzel-take";
export const TAKE_VERSION = 1;
export const MAX_TAKE_TEXT_CHARS = 8_000_000;
export const MAX_TAKE_ENTRIES = 200_000;
export const MIN_TAKE_SECONDS = 1;

/** Common prefix and suffix: next = previous.slice(0, at) + insert + previous.slice(at + remove). */
export interface TextDiff {
  readonly at: number;
  readonly remove: number;
  readonly insert: string;
}

export type TakeCommand =
  | {
      readonly kind: "sounding";
      readonly source: TextDiff;
      readonly solo: string | null;
      readonly preview: { readonly track: string; readonly text: string } | null;
    }
  | { readonly kind: "play"; readonly mode: PlaybackMode; readonly startBar: number | null }
  | { readonly kind: "mode"; readonly mode: PlaybackMode }
  | { readonly kind: "stop" }
  | { readonly kind: "range"; readonly change: PlayRangeChange }
  | { readonly kind: "background"; readonly isHidden: boolean }
  // Demo only (includesAuditions): the library audition and the note preview.
  | { readonly kind: "audition"; readonly program: Program }
  | { readonly kind: "auditionNote"; readonly program: Program; readonly midis: readonly number[]; readonly seconds: number }
  | { readonly kind: "auditionStop" };

export interface TakeEntry {
  readonly command: TakeCommand;
  /** The transport's clock frame while it handled the command (held for the whole message). */
  readonly frame: number;
  /** scheduledUntil() BEFORE the command; null when the transport was stopped. */
  readonly horizon: number | null;
  /** play only, when it started the music: the frame of its first sound (receipt.after). */
  readonly startFrame?: number;
}

export interface Take {
  readonly format: typeof TAKE_FORMAT;
  readonly version: typeof TAKE_VERSION;
  readonly sampleRate: number;
  /** Frame of the arm receipt: where the replay's transport starts. */
  readonly armFrame: number;
  readonly endFrame: number;
  readonly endedBy: "stop" | "cap" | "full" | "interrupted";
  readonly entries: readonly TakeEntry[];
  /** Every instrument of a program that sounded: the render loads their sample packs. */
  readonly instruments: readonly string[];
  /** session.view().title at Stop: null without a title line, never the catalog's "Untitled". */
  readonly title: string | null;
}
