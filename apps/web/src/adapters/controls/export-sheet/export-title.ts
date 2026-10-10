// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the exported video says about the song: the title, or the
// catalog's "Untitled" for an older text without a title line, and the tempo and key in
// the transport's own words. Pure.
import { tempoAndKey } from "@untzel/skin";
import { titleSlug } from "@untzel/core";
import { DEFAULT_BPM, keyLabel } from "@untzel/presentation";
import type { SessionView } from "@untzel/session";
export interface ExportTitleText {
  readonly text: string;
  /** `132 BPM · c minor`, under the title on the card. */
  readonly detail: string;
  /** The files' name stem: the title's slug, "untzel" for a text without a title line. */
  readonly fileStem: string;
}
export function exportTitleText(view: Pick<SessionView, "title" | "tempo" | "key">, untitled: string): ExportTitleText {
  return {
    text: view.title ?? untitled,
    detail: tempoAndKey({ bpm: view.tempo ?? DEFAULT_BPM, key: keyLabel(view.key) }),
    fileStem: titleSlug(view.title ?? "") || "untzel",
  };
}
