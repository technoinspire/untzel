// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Listen in the export sheet: plays the stretch about to be exported,
// from its first bar, in its mode, and stops after its last bar, so what is heard is what
// the file will hold. The play range is left alone; the sheet's ruler shows the playhead.
// Stops on its own when the music passes the stretch, wraps back, or something else
// stops it.
import type { PlaybackMode, Session, SessionResult, SessionView, Unsubscribe } from "@untzel/session";
import { TICKS_PER_BAR } from "@untzel/session/rules";

/** The stretch to hear: ticks from the ruler's left edge, half-open. */
export interface ListenedStretch {
  readonly mode: PlaybackMode;
  readonly startTick: number;
  readonly endTick: number;
}

export type ListeningSession = Pick<Session, "subscribe" | "stop" | "view"> & {
  playFromBar(mode: PlaybackMode, startBar: number): SessionResult;
};

/** 0-based bar of the ruler that plays now, in `mode`; null when that mode does not sound. */
export function rulerBarNow(view: SessionView, mode: PlaybackMode): number | null {
  const position = view.position;
  if (!view.playing || position === null || position.mode !== mode) return null;
  return mode === "loop" ? position.loopBar : position.bar;
}

export class ExportListening {
  readonly #session: ListeningSession;
  readonly #onChange: () => void;
  /** `isArmed` once the new play reports its start bar: earlier positions are the old play's. */
  #listening: { readonly mode: PlaybackMode; readonly startBar: number; readonly endBar: number; lastBar: number; isArmed: boolean } | null = null;
  #unsubscribe: Unsubscribe | null = null;

  constructor(session: ListeningSession, onChange: () => void) {
    this.#session = session;
    this.#onChange = onChange;
  }

  get isListening(): boolean {
    return this.#listening !== null;
  }

  /** Listen, or stop the listening. */
  toggle(stretch: ListenedStretch | null): SessionResult {
    if (this.#listening !== null) {
      this.stop();
      return { ok: true };
    }
    if (stretch === null) return { ok: false, code: "NO_PROGRAM" };
    const startBar = Math.floor(stretch.startTick / TICKS_PER_BAR);
    const endBar = Math.ceil(stretch.endTick / TICKS_PER_BAR);
    const result = this.#session.playFromBar(stretch.mode, startBar);
    if (!result.ok) return result;
    this.#listening = { mode: stretch.mode, startBar, endBar, lastBar: startBar, isArmed: false };
    this.#unsubscribe ??= this.#session.subscribe((view) => this.#follow(view));
    this.#onChange();
    return result;
  }

  /** The sheet closed or Listen pressed again: the music stops. */
  stop(): void {
    if (this.#listening === null) return;
    this.#listening = null;
    this.#session.stop();
    this.#onChange();
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  #follow(view: SessionView): void {
    const listening = this.#listening;
    if (listening === null) return;
    if (!view.playing) {
      // Stopped elsewhere (the transport's pause, another play): nothing to stop.
      this.#listening = null;
      this.#onChange();
      return;
    }
    const bar = rulerBarNow(view, listening.mode);
    if (bar === null) return;
    if (!listening.isArmed) {
      listening.isArmed = bar === listening.startBar;
      return;
    }
    // Past the stretch, or wrapped back to the loop's start: what the file holds is over.
    if (bar >= listening.endBar || bar < listening.lastBar) this.stop();
    else listening.lastBar = bar;
  }
}
