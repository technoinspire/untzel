// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { PatternSourceEditor, SourceEdit } from "../ports";
import type { CommandResult, Session } from "../use-cases/session";

// The pattern chips of the track detail: a tap previews the pattern
// inside the music (Session.previewTrack), the confirmation writes it. Both use the same
// edit, already in the music's key, so what is heard is what is written.

export class PatternEdits {
  readonly #session: Session;
  readonly #editor: PatternSourceEditor;

  constructor(session: Session, editor: PatternSourceEditor) {
    this.#session = session;
    this.#editor = editor;
  }

  /** The track plays `pattern` from the next bar, for 16 bars; the text does not change. */
  preview(track: string, pattern: string): CommandResult {
    const edit = this.#candidate(track, pattern);
    if (!edit.ok) return { ok: false, code: edit.reason };
    return this.#session.previewTrack(track, edit.source, pattern);
  }

  /**
   * Writes `pattern` on the track (the instrument, the sound and the modifiers stay), one
   * step. When that pattern is previewing, Use writes exactly the text that was heard.
   */
  setTrackPattern(track: string, pattern: string): CommandResult {
    const options = { label: { what: "pattern", target: track } };
    if (this.#session.applyTrackPreview(track, pattern, options).ok) return { ok: true };
    const edit = this.#candidate(track, pattern);
    if (!edit.ok) return { ok: false, code: edit.reason };
    this.#session.applyText(edit.source, options);
    return { ok: true };
  }

  #candidate(track: string, pattern: string): SourceEdit {
    const { source, program } = this.#session.state();
    const instrument = program?.tracks.find((entry) => entry.name === track)?.instrument;
    if (instrument === undefined) return { ok: false, reason: "UNKNOWN_TRACK" };
    return this.#editor.setTrackPattern(source, track, instrument, pattern, this.#session.view().key);
  }
}
