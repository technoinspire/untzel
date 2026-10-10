// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { EditOptions } from "../use-cases/history";
import type { ArrangementSourceEditor, NamedSourceEdit, SourceEdit } from "../ports";
import type { CommandFailure, CommandResult, NamedCommandResult, Session } from "../use-cases/session";

export interface SongEditsDependencies {
  /** Owns the text: every edit is applied through applyText, like typing. */
  readonly session: Session;
  readonly editor: ArrangementSourceEditor;
}

/** A new part's length when neither a playing part nor the loop gives one. */
const DEFAULT_PART_BARS = 8;
const OK = { ok: true } as const;

function fail(code: CommandFailure): { readonly ok: false; readonly code: CommandFailure } {
  return { ok: false, code };
}

/**
 * The Song view's gestures: a part's length, its place in the song,
 * a copy of it, and a new part from what is playing. Each one is one applyText, one
 * undo step. A text with sections and no `song` plays one 8-bar part per section; the
 * first edit of a part writes that song first, in the same edit, so what the person sees
 * is what they edit.
 */
export class SongEdits {
  readonly #session: Session;
  readonly #editor: ArrangementSourceEditor;

  constructor(dependencies: SongEditsDependencies) {
    this.#session = dependencies.session;
    this.#editor = dependencies.editor;
  }

  setPartBars(part: number, bars: number): CommandResult {
    return this.#partEdit(part, (source) => this.#editor.setPartBars(source, part, bars), "length");
  }

  /** -1 moves the part earlier in the song, +1 later. */
  movePart(part: number, delta: -1 | 1): CommandResult {
    return this.#partEdit(part, (source) => this.#editor.movePart(source, part, delta), "move");
  }

  duplicatePart(part: number): CommandResult {
    return this.#partEdit(part, (source) => this.#editor.duplicatePart(source, part), "duplicate");
  }

  /** Renames a part: its section line and every use in the song, one edit. */
  renameSection(section: string, newName: string): CommandResult {
    if (!this.#session.view().sections.some((entry) => entry.name === section)) return fail("UNKNOWN_SECTION");
    const result = this.#apply((source) => {
      const edit = this.#editor.renameSection(source, section, newName);
      return edit.ok ? { ...edit, name: newName } : edit;
    }, { label: { what: "rename", target: newName } });
    return result.ok ? OK : result;
  }

  /**
   * A new section with the tracks sounding now and a part at the end of the song. It
   * lasts as long as the part playing (song mode) or the loop (loop mode).
   */
  addPartFromPlaying(): NamedCommandResult {
    const view = this.#session.view();
    if (this.#session.state().program === null) return fail("NO_PROGRAM");
    const tracks = view.tracks.filter((track) => !track.muted && track.inSection !== false).map((track) => track.name);
    if (tracks.length === 0) return fail("NOTHING_PLAYING");
    const current = view.song?.currentPart ?? null;
    const bars = (current === null ? null : view.song?.parts[current]?.bars) ?? view.loop?.bars ?? DEFAULT_PART_BARS;
    return this.#apply((source) => this.#editor.addSection(this.#withSong(source), tracks, bars), { label: { what: "add part", target: null } });
  }

  #partEdit(part: number, edit: (source: string) => SourceEdit, what: string): CommandResult {
    const parts = this.#session.view().song?.parts ?? [];
    if (!Number.isInteger(part) || part < 0 || part >= parts.length) return fail("UNKNOWN_PART");
    const result = this.#apply((source) => {
      const applied = edit(this.#withSong(source));
      return applied.ok ? { ...applied, name: "" } : applied;
    }, { label: { what, target: parts[part]?.section ?? null } });
    return result.ok ? OK : result;
  }

  /** The source with the song the transport plays written out, when the text has none. */
  #withSong(source: string): string {
    const song = this.#session.view().song;
    if (song === null || song.declared) return source;
    const declared = this.#editor.declareSong(source, song.parts.map((part) => ({ section: part.section, bars: part.bars })));
    return declared.ok ? declared.source : source;
  }

  #apply(edit: (source: string) => NamedSourceEdit, options: EditOptions): NamedCommandResult {
    const result = edit(this.#session.state().source);
    if (!result.ok) return fail(result.reason);
    this.#session.applyText(result.source, options);
    return { ok: true, name: result.name };
  }
}
