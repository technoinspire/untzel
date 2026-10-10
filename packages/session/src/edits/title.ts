// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { normalizeTitle } from "@untzel/core";
import type { TitleSourceEditor } from "../ports";
import type { Session } from "../use-cases/session";
export interface TitleEditsDependencies {
  /** Owns the text: the rename goes through applyText, like typing (one undo step). */
  readonly session: Session;
  readonly editor: TitleSourceEditor;
}
/**
 * What a rename did. `unchanged`: the same title, nothing written and no undo step.
 * `invalid`: empty after normalizing, the title before it stays.
 */
export type TitleResult =
  | { readonly kind: "changed"; readonly title: string }
  | { readonly kind: "unchanged" }
  | { readonly kind: "invalid" };
/** The song title's use case: every rename, from the bar or the menu, goes through it. */
export class TitleEdits {
  readonly #session: Session;
  readonly #editor: TitleSourceEditor;
  constructor(dependencies: TitleEditsDependencies) {
    this.#session = dependencies.session;
    this.#editor = dependencies.editor;
  }
  setTitle(raw: string): TitleResult {
    const title = normalizeTitle(raw);
    if (title === "") return { kind: "invalid" };
    if (title === this.#session.view().title) return { kind: "unchanged" };
    const edit = this.#editor.setTitleEdit(this.#session.state().source, title);
    if (!edit.ok) return { kind: "invalid" };
    this.#session.applyText(edit.source);
    return { kind: "changed", title };
  }
}
