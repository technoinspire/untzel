// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { AuditionIntents } from "@untzel/skin-contract";
import { AuditionVoices, auditionDurationMs, type AuditionSound, type NoteAudition, type Session } from "@untzel/session";
import type { InstrumentRegistry } from "@untzel/core";

export interface AuditionControlsOptions {
  readonly session: Session;
  readonly registry: InstrumentRegistry;
  readonly audition: NoteAudition;
  /** Milliseconds now; tests pass their own clock. */
  readonly now?: () => number;
}

/**
 * Every note the person touches sounds: one voice per track, a
 * drum's hit about one step long, other instruments about 400 ms. Hands the sound to the
 * NoteAudition port; the text and the transport are never touched.
 */
export class AuditionControls implements AuditionIntents {
  readonly #options: AuditionControlsOptions;
  readonly #voices = new AuditionVoices();
  readonly #now: () => number;

  constructor(options: AuditionControlsOptions) {
    this.#options = options;
    this.#now = options.now ?? (() => performance.now());
  }

  audition(track: string, sound: AuditionSound): void {
    const view = this.#options.session.view();
    const found = view.tracks.find((entry) => entry.name === track);
    if (found === undefined || !this.#voices.admit(track, sound, this.#now())) return;
    const kind = this.#options.registry.get(found.instrument)?.kind ?? "pitched";
    this.#options.audition.audition(track, sound, auditionDurationMs(kind, view.tempo ?? 132));
  }
}
