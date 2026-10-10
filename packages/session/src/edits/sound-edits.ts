// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { EFFECT_KINDS, type EffectKind } from "@untzel/core";
import type { EditOptions } from "../use-cases/history";
import type { SourceEdit } from "../ports";
import type { CommandResult, Session } from "../use-cases/session";

/** The text edits of the sound group; @untzel/language binds them. */
export interface SoundEditor {
  /** `sound` null or the default sound of `instrument` removes the word. */
  setSound(source: string, track: string, instrument: string, sound: string | null): SourceEdit;
  addEffect(source: string, track: string, effect: EffectKind): SourceEdit;
  removeEffect(source: string, track: string, effect: EffectKind): SourceEdit;
  /** Change sound: another instrument and sound; the pattern and the compatible modifiers stay. */
  setInstrument(source: string, track: string, instrument: string, preset: string | null): SourceEdit;
}

function isEffect(name: string): name is EffectKind {
  return (EFFECT_KINDS as readonly string[]).includes(name);
}

function on(what: string, track: string): EditOptions {
  return { label: { what, target: track } };
}

/** What a Change sound preview is called ("acid · squelch", or "acid" for the default sound). */
function soundLabel(instrument: string, preset: string | null): string {
  return preset === null ? instrument : `${instrument} · ${preset}`;
}

/** The sound and the insert effects of a track, each one edit applied like typing. */
export class SoundEdits {
  readonly #session: Session;
  readonly #editor: SoundEditor;

  constructor(session: Session, editor: SoundEditor) {
    this.#session = session;
    this.#editor = editor;
  }

  setSound(track: string, sound: string | null): CommandResult {
    const instrument = this.#session.state().program?.tracks.find((entry) => entry.name === track)?.instrument;
    if (instrument === undefined) return { ok: false, code: "UNKNOWN_TRACK" };
    return this.#edit((source) => this.#editor.setSound(source, track, instrument, sound), on("sound", track));
  }

  /**
   * Change sound: `instrument` and `preset` for the track, keeping its
   * pattern and the parameters the new instrument also has. One step.
   */
  setTrackSound(track: string, instrument: string, preset: string | null): CommandResult {
    if (!this.#hasTrack(track)) return { ok: false, code: "UNKNOWN_TRACK" };
    const options = on("sound", track);
    // Use after a preview of this very sound writes exactly the text that was heard.
    if (this.#session.applyTrackPreview(track, soundLabel(instrument, preset), options).ok) return { ok: true };
    return this.#edit((source) => this.#editor.setInstrument(source, track, instrument, preset), options);
  }

  /** Change sound's preview: the track plays the new sound in the music; the text stays. */
  previewTrackSound(track: string, instrument: string, preset: string | null): CommandResult {
    const edit = this.#editor.setInstrument(this.#session.state().source, track, instrument, preset);
    if (!edit.ok) return { ok: false, code: edit.reason };
    return this.#session.previewTrack(track, edit.source, soundLabel(instrument, preset));
  }

  addEffect(track: string, effect: string): CommandResult {
    if (!isEffect(effect)) return { ok: false, code: "INVALID_NAME" };
    return this.#edit((source) => this.#editor.addEffect(source, track, effect), on(effect, track));
  }

  removeEffect(track: string, effect: string): CommandResult {
    if (!isEffect(effect)) return { ok: false, code: "INVALID_NAME" };
    return this.#edit((source) => this.#editor.removeEffect(source, track, effect), on(effect, track));
  }

  #hasTrack(track: string): boolean {
    return this.#session.state().program?.tracks.some((entry) => entry.name === track) === true;
  }

  #edit(apply: (source: string) => SourceEdit, options: EditOptions): CommandResult {
    const result = apply(this.#session.state().source);
    if (!result.ok) return { ok: false, code: result.reason };
    this.#session.applyText(result.source, options);
    return { ok: true };
  }
}
