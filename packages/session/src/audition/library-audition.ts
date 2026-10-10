// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Listening before adding: the library plays an
// instrument in the key and tempo of the music without touching the text. The audition
// is analyzed by the same language as typing, so what is heard is what Add writes.

import { pitchClassName, transposeFromC, type InstrumentManifest, type InstrumentRegistry, type Key } from "@untzel/core";
import { patternInKey, type AnalyzeResult } from "@untzel/language";
import type { DiagnosticsLog, PreviewPort, Unsubscribe } from "../ports";
import type { Session } from "../use-cases/session";

/** The track name of the audition text; never written anywhere. */
export const AUDITION_TRACK = "p";
const DEFAULT_TEMPO = 124;

export interface AuditionDependencies {
  readonly session: Session;
  readonly port: PreviewPort;
  readonly registry: InstrumentRegistry;
  readonly analyze: (source: string) => AnalyzeResult;
  readonly log: DiagnosticsLog;
}

export interface Auditioning {
  readonly instrument: string;
  /** The named sound playing; null is the default one. */
  readonly preset: string | null;
  /** The named pattern playing; null plays the manifest's preview. */
  readonly pattern: string | null;
}


/** The audition's pattern: a named one already in the key (as Add writes it), else the preview with `| transpose`. */
function auditionPattern(manifest: InstrumentManifest, pattern: string | null, key: Key | null): string | null {
  if (pattern !== null) {
    const named = manifest.patterns.find((entry) => entry.name === pattern);
    return named === undefined ? null : patternInKey(named.text, manifest.kind, key);
  }
  const transpose = transposeFromC(key?.tonic ?? 0);
  const moved = manifest.kind === "drum" || transpose === 0 ? "" : ` | transpose ${transpose}`;
  return `${manifest.preview}${moved}`;
}

/**
 * The text of an audition: the music's tempo and key, then one track playing the named
 * pattern in the key (the text Add writes), or without one the manifest's preview moved to
 * the tonic (drums are not moved). A chromatic key auditions in minor; without a key,
 * c minor. Null when the pattern is not the manifest's or leaves the playable notes.
 */
export function auditionText(manifest: InstrumentManifest, preset: string | null, pattern: string | null, key: Key | null, tempo: number | null): string | null {
  const tonic = key?.tonic ?? 0;
  const scale = key === null || key.scale === "chromatic" ? "minor" : key.scale;
  const sound = preset === null || preset === manifest.defaultPreset ? "" : ` ${preset}`;
  const played = auditionPattern(manifest, pattern, key);
  if (played === null) return null;
  return `tempo ${tempo ?? DEFAULT_TEMPO}\nkey ${pitchClassName(tonic)} ${scale}\n${AUDITION_TRACK}: ${manifest.name}${sound} ${played}\n`;
}


/** A voice of the preview slot: an audition of the library, or a touched note. */
type SlotVoice = "audition" | "note";
export class Audition {
  readonly #dependencies: AuditionDependencies;
  #current: Auditioning | null = null;
  /**
   * What the preview slot plays: an audition, a touched note (which never ends by itself),
   * or nothing. Starting over a voice cuts it, and the worker says so with an end.
   */
  #occupant: SlotVoice | null = null;
  /** The voices cut and not yet reported ended, oldest first: each coming end is theirs. */
  readonly #cuts: SlotVoice[] = [];
  readonly #listeners = new Set<() => void>();

  constructor(dependencies: AuditionDependencies) {
    this.#dependencies = dependencies;
    dependencies.port.onPreviewEnded(() => this.#ended());
  }

  current(): Auditioning | null {
    return this.#current;
  }

  /** Starts (or switches) the audition; false when the instrument, the pattern or its text is invalid. */
  play(instrument: string, preset: string | null, pattern: string | null = null): boolean {
    const { registry, session, analyze, port, log } = this.#dependencies;
    const manifest = registry.get(instrument);
    if (manifest === undefined) return false;
    const view = session.view();
    const text = auditionText(manifest, preset, pattern, view.key, view.tempo);
    if (text === null) return false;
    const result = analyze(text);
    if (!result.ok) {
      log.internalError("preview", new Error(`${instrument}: ${result.diagnostics[0]?.message ?? "invalid preview"}`));
      return false;
    }
    this.#occupy("audition");
    port.preview(result.program);
    this.#current = { instrument, preset, pattern };
    this.#notify();
    return true;
  }

  /**
   * Plays `midis` (a note or a chord) on the track as it sounds in the music: its
   * instrument, sound, effects and gain, now, for `seconds` (auditionDurationMs), cutting
   * the note before. False for an unknown track or no note.
   */
  playNote(track: string, midis: readonly number[], seconds: number): boolean {
    const { session, registry, port } = this.#dependencies;
    const program = session.state().program;
    const found = program?.tracks.find((entry) => entry.name === track);
    if (program === null || program === undefined || found === undefined || registry.get(found.instrument) === undefined || midis.length === 0) return false;
    const solo = { ...program, tracks: [{ ...found, muted: false }], sections: [], song: null };
    this.#occupy("note");
    port.previewNote(solo, midis, seconds);
    return true;
  }
  stop(): void {
    if (this.#current === null) return;
    this.#vacate();
    this.#dependencies.port.stopPreview();
  }

  /** The library redraws on every start and end. */
  onChange(listener: () => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #occupy(voice: SlotVoice): void {
    this.#vacate();
    this.#occupant = voice;
  }
  #vacate(): void {
    if (this.#occupant !== null) this.#cuts.push(this.#occupant);
    this.#occupant = null;
  }
  /**
   * An end of the slot: of a voice cut earlier, or of the one playing (its 16 bars, Play,
   * Stop). The audition is over unless the end was of a voice another audition replaced.
   */
  #ended(): void {
    const cut = this.#cuts.shift();
    const voice = cut ?? this.#occupant;
    // Not a cut: the voice playing ended by itself, or by Play or Stop; the slot is free.
    if (cut === undefined) this.#occupant = null;
    if (voice !== "audition" || this.#occupant === "audition") return;
    if (this.#current === null) return;
    this.#current = null;
    this.#notify();
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}
