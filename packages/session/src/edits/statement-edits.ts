// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ScaleName } from "@untzel/core";
import type { SourceEdit, StatementSourceEditor } from "../ports";
import type { CommandResult, Session } from "../use-cases/session";

// The song's tempo and key from the transport. The transport takes a
// new tempo or key on the next bar, so the music never stops. Changes in a row from the
// same open editor (five taps on +, a tonic then a scale, the taps of tap tempo) are one
// undo step until the editor closes (Session.endGesture).

/** Merge keys: one open editor is one step. */
const TEMPO_STEP = "statement:tempo";
const KEY_STEP = "statement:key";

export class StatementEdits {
  readonly #session: Session;
  readonly #editor: StatementSourceEditor;

  constructor(session: Session, editor: StatementSourceEditor) {
    this.#session = session;
    this.#editor = editor;
  }

  /** Always the global `tempo` line, never a section's `| tempo`. */
  setTempo(bpm: number): CommandResult {
    return this.#edit((source) => this.#editor.setTempo(source, bpm), "tempo", TEMPO_STEP);
  }

  setKey(tonic: string, scale: ScaleName): CommandResult {
    return this.#edit((source) => this.#editor.setKey(source, tonic, scale), "key", KEY_STEP);
  }

  #edit(apply: (source: string) => SourceEdit, what: string, mergeKey: string): CommandResult {
    if (this.#session.state().program === null) return { ok: false, code: "NO_PROGRAM" };
    const result = apply(this.#session.state().source);
    if (!result.ok) return { ok: false, code: result.reason };
    this.#session.applyText(result.source, { label: { what, target: null }, mergeKey });
    return { ok: true };
  }
}
