// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The one editable name of the interface: a track or a part,
// edited where it is shown. Pure presentation: it validates with the language's own rule
// (checkName, re-exported by the session) and writes the words; the view only draws it.
// The song title is the third kind: free text up to 60 code points, by
// core's normalizeTitle, the same rule as the title in the bar.
import { TITLE_MAX_CODE_POINTS, isTitleTooLong, normalizeTitle } from "@untzel/core";
import { checkName } from "@untzel/session/rules";
import { strings } from "../../copy/copy";
export type InlineNameKind = "track" | "part" | "title";

export interface InlineNameModel {
  readonly kind: InlineNameKind;
  /** The name in the text now. */
  readonly value: string;
  /** null = idle; a string = editing, as typed. */
  readonly draft: string | null;
  readonly fieldLabel: string;
  /**
   * The idle button's own label; null when the name it shows is the label. A track's or
   * a part's name sits in the sheet's heading, which must read the name alone.
   */
  readonly buttonLabel: string | null;
  /** What the idle button does, read after its name: "Rename track"; null for none. */
  readonly buttonDescription: string | null;
  /** The line under the field. */
  readonly rule: string;
  /** The message that replaces the rule; null when the draft can be written. */
  readonly error: string | null;
}

/** What Enter or leaving the field does. */
export type InlineNameCommit =
  | { readonly kind: "write"; readonly name: string }
  /** The same name: nothing is written, the field closes. */
  | { readonly kind: "close" }
  /** Invalid: Enter keeps the field open; leaving keeps the old name and says why. */
  | { readonly kind: "refuse"; readonly reason: string };

function titleError(value: string, draft: string): string | null {
  if (normalizeTitle(draft) === "") return strings.titleEmpty(value);
  return isTitleTooLong(draft) ? strings.titleTooLong(TITLE_MAX_CODE_POINTS) : null;
}
function nameError(kind: InlineNameKind, value: string, draft: string, taken: ReadonlySet<string>): string | null {
  if (draft === value) return null;
  if (kind === "title") return titleError(value, draft);
  if (draft === "") return strings.nameEmpty(value);
  switch (checkName(draft, taken)) {
    case "INVALID_NAME":
      return strings.nameInvalid;
    case "RESERVED_NAME":
      return strings.nameReserved(draft);
    case "NAME_TAKEN":
      return kind === "track" ? strings.trackNameTaken(draft) : strings.partNameTaken(draft);
    case null:
      return null;
  }
}

function fieldLabelOf(kind: InlineNameKind): string {
  if (kind === "title") return strings.songTitle;
  return kind === "track" ? strings.trackNameField : strings.partNameField;
}
function buttonDescriptionOf(kind: InlineNameKind): string | null {
  if (kind === "title") return null;
  return kind === "track" ? strings.renameTrackHint : strings.renamePartHint;
}
/** `taken`: the other names of the same kind (tracks and parts are separate spaces). */
export function inlineNameModel(kind: InlineNameKind, value: string, draft: string | null, taken: ReadonlySet<string>): InlineNameModel {
  return {
    kind,
    value,
    draft,
    fieldLabel: fieldLabelOf(kind),
    // A project row's title is no heading: "Rename Midnight Coast" names it there.
    buttonLabel: kind === "title" ? strings.renameTitle(value) : null,
    buttonDescription: buttonDescriptionOf(kind),
    rule: kind === "title" ? strings.titleRule(TITLE_MAX_CODE_POINTS) : strings.nameRule,
    error: draft === null ? null : nameError(kind, value, draft, taken),
  };
}

export function commitOf(model: InlineNameModel): InlineNameCommit {
  const typed = model.draft ?? model.value;
  // A title is written as normalizeTitle leaves it: "  Night  Drive " is "Night Drive".
  const draft = model.kind === "title" && model.error === null ? normalizeTitle(typed) : typed;
  if (draft === model.value) return { kind: "close" };
  if (model.error !== null) return { kind: "refuse", reason: model.error };
  return { kind: "write", name: draft };
}

/** The polite announcement after a rename, or when leaving the field kept the old name. */
export function renamedAnnouncement(commit: InlineNameCommit, value: string): string | null {
  if (commit.kind === "write") return strings.renamed(value, commit.name);
  if (commit.kind === "refuse") return strings.nameNotChanged(`${commit.reason.charAt(0).toLowerCase()}${commit.reason.slice(1)}`);
  return null;
}
