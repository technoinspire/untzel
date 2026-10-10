// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The take: recording the transport's inputs and the take as text. The page
// loads this entry only on the first Record; the replay is the "./replay" entry.
export {
  MAX_TAKE_ENTRIES,
  MAX_TAKE_TEXT_CHARS,
  MIN_TAKE_SECONDS,
  TAKE_FORMAT,
  TAKE_VERSION,
  type Take,
  type TakeCommand,
  type TakeEntry,
  type TextDiff,
} from "./take";
export { applyTextDiff, diffText } from "./text-diff";
export {
  TakeRecorder,
  type CommandReceipt,
  type ReceiptOutcome,
  type SentCommand,
  type TakeRecorderOptions,
} from "./take-recorder";
export { takeSpan, type TakeOrigin, type TakeSpan } from "./take-span";
export { decodeTake, encodeTake, type DecodedTake, type TakeDecodeFailure } from "./take-codec";
