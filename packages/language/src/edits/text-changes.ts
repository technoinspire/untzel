// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/** One replacement of the source, in offsets of the text before the edit. */
export interface TextChange {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
}

/** Why an edit could not be made. The source is left as it was. */
export type EditFailure =
  | "UNKNOWN_TRACK"
  | "UNKNOWN_SECTION"
  | "UNKNOWN_PART"
  | "UNKNOWN_STEP"
  | "INVALID_NAME"
  | "RESERVED_NAME"
  | "NAME_TAKEN"
  | "INVALID_VALUE"
  | "SECTION_WOULD_BE_EMPTY"
  | "NO_LOOP_SECTION";

export interface AppliedEdit {
  readonly ok: true;
  /** The whole text after the edit. */
  readonly source: string;
  readonly changes: readonly TextChange[];
}

export interface FailedEdit {
  readonly ok: false;
  readonly reason: EditFailure;
}

export type EditResult = AppliedEdit | FailedEdit;

/** An edit that creates a track also says which name it got. */
export type NamedEditResult = (AppliedEdit & { readonly name: string }) | FailedEdit;

export function failure(reason: EditFailure): FailedEdit {
  return { ok: false, reason };
}

/** Applies non-overlapping changes, all expressed in offsets of `source`. */
export function applyChanges(source: string, changes: readonly TextChange[]): AppliedEdit {
  const ordered = [...changes].sort((a, b) => b.from - a.from);
  let text = source;
  for (const change of ordered) {
    text = text.slice(0, change.from) + change.insert + text.slice(change.to);
  }
  return { ok: true, source: text, changes: [...changes].sort((a, b) => a.from - b.from) };
}
