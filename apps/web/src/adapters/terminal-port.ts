// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The composer terminal's port over the real Session. A
// proposal arrives as a whole text and goes through applyText, like typing; play, stop,
// drop, solo, undo and redo are the session's own use cases. Nothing here edits text.

import type { SessionAction } from "@untzel/commands";
import type { ActionResult, TerminalPort, TerminalState } from "@untzel/editor";
import type { CommandResult, Session, TrackEdits, Unsubscribe } from "@untzel/session";

export interface SessionTerminalPortOptions {
  readonly session: Session;
  readonly edits: TrackEdits;
  /** Called synchronously inside the key press or tap that runs "play". */
  readonly resumeAudio: () => void;
}

function result(outcome: CommandResult | { readonly ok: true } | { readonly ok: false; readonly code: string }): ActionResult {
  return outcome.ok ? { ok: true } : { ok: false, code: outcome.code };
}

export class SessionTerminalPort implements TerminalPort {
  readonly #options: SessionTerminalPortOptions;

  constructor(options: SessionTerminalPortOptions) {
    this.#options = options;
  }

  state(): TerminalState {
    const view = this.#options.session.view();
    return { source: view.source, playing: view.playing, bar: view.playing ? (view.position?.bar ?? null) : null };
  }

  subscribe(listener: (state: TerminalState) => void): Unsubscribe {
    return this.#options.session.subscribe(() => listener(this.state()));
  }

  apply(source: string): void {
    const { session } = this.#options;
    if (source !== session.view().source) session.applyText(source);
  }

  perform(action: SessionAction): ActionResult {
    const { session, edits, resumeAudio } = this.#options;
    switch (action.kind) {
      case "play":
        resumeAudio();
        return result(session.play(session.view().mode ?? "loop"));
      case "stop":
        session.stop();
        return { ok: true };
      case "drop":
        return result(edits.drop());
      case "undo":
        return result(session.undo());
      case "redo":
        return result(session.redo());
      case "solo": {
        // Solo again on the soloed track releases it.
        const released = session.view().solo === action.track;
        const outcome = session.solo(released ? null : action.track);
        return outcome.ok ? { ok: true, released } : { ok: false, code: outcome.code };
      }
    }
  }
}
