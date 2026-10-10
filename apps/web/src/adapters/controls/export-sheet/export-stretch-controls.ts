// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export sheet's stretch intents over ExportStretchState:
// its ruler follows the play range's (or the mode that plays), each edit is cut to the
// format's cap, a handle let go and "Use play range" are said once (never a key or a
// drag in flight), and a smaller cap after a format or quality change is said too.
import { clockLabel } from "@untzel/skin";
import type { RangeGesture } from "@untzel/skin-contract";
import type { ExportStretch, PlaybackMode, Session } from "@untzel/session";
import { announcements } from "../../../strings/copy";
import { ExportStretchState } from "./export-stretch";
import type { ExportFormat, ExportQualityName, ExportStretchView } from "@untzel/presentation/view-model";

/** The play range the stretch copies: its ruler and bars. */
export interface StretchFollow {
  readonly mode: PlaybackMode;
  readonly startBar: number;
  readonly endBar: number;
  /** "Bars 9–28 · build → drop": the sheet says it while the stretch is this range. */
  readonly label: string;
}

export interface ExportStretchContext {
  readonly session: Session;
  readonly announce: (message: string) => void;
  /** The cap of the format and quality chosen now, and its words; null before the export module loads. */
  readonly cap: () => { readonly seconds: number; readonly note: string } | null;
  /** The cap of any format at a quality, for the durations of the other formats. */
  readonly capOf: (format: ExportFormat, quality: ExportQualityName) => number | null;
}

export class ExportStretchControls {
  readonly #context: ExportStretchContext;
  readonly #state = new ExportStretchState();
  #follow: StretchFollow | null = null;

  constructor(context: ExportStretchContext) {
    this.#context = context;
  }

  follow(range: StretchFollow | null): void {
    this.#follow = range;
  }

  get stretch(): ExportStretch | null {
    this.#sync();
    return this.#state.stretch;
  }

  get mode(): PlaybackMode | null {
    this.#sync();
    return this.#state.mode;
  }
  /** The ruler's mode while there is a stretch; null without one. */
  get stretchMode(): PlaybackMode | null {
    const mode = this.mode;
    return mode !== null && this.stretch !== null ? mode : null;
  }

  view(): ExportStretchView | null {
    this.#sync();
    const cap = this.#context.cap();
    return cap === null ? null : this.#state.view(cap.seconds, this.#follow?.label ?? null);
  }

  /** The stretch as `format` at `quality` would take it, cut to its own cap. */
  stretchFor(format: ExportFormat, quality: ExportQualityName): ExportStretch | null {
    this.#sync();
    const cap = this.#context.capOf(format, quality);
    return cap === null ? null : this.#state.trimmedTo(cap);
  }

  /** False before the export module loads: nothing changes. */
  set(startTick: number, endTick: number, gesture: RangeGesture): boolean {
    const cap = this.#context.cap();
    if (cap === null) return false;
    this.#sync();
    this.#state.set({ startTick, endTick }, cap.seconds);
    if (gesture === "release") this.#say(cap);
    return true;
  }

  setFine(isFine: boolean): void {
    this.#state.setFine(isFine);
  }

  reset(): boolean {
    const cap = this.#context.cap();
    if (cap === null) return false;
    this.#sync();
    this.#state.reset(cap.seconds);
    this.#say(cap);
    return true;
  }

  /** After a format or quality change: a smaller cap brings the end back, and that is said. */
  trimToCap(): void {
    const cap = this.#context.cap();
    if (cap === null) return;
    const before = this.#state.stretch;
    this.#sync();
    this.#state.trim(cap.seconds);
    const after = this.#state.stretch;
    if (before !== null && after !== null && after.endTick < before.endTick) this.#context.announce(announcements.exportStretchTrimmed(cap.note));
  }

  #say(cap: { readonly seconds: number; readonly note: string }): void {
    const stretch = this.#state.stretch;
    if (stretch === null) return;
    const at = (tick: number): string => clockLabel(this.#state.secondsAt(tick));
    this.#context.announce(announcements.exportStretchSet(at(stretch.startTick), at(stretch.endTick), this.#state.isAtCap(cap.seconds) ? cap.note : null));
  }

  /** The play range's ruler, else the mode asked for, as the transport's ruler (a song only with parts). */
  #sync(): void {
    const { session } = this.#context;
    const view = session.view();
    const hasSong = (view.song?.parts.length ?? 0) > 0;
    const wanted = this.#follow?.mode ?? session.state().mode ?? view.mode ?? "loop";
    const range = this.#follow === null ? null : { startBar: this.#follow.startBar, endBar: this.#follow.endBar };
    const source = { mode: wanted === "song" && !hasSong ? ("loop" as const) : wanted, range };
    this.#state.sync(session.state().program, source, this.#context.cap()?.seconds ?? Number.POSITIVE_INFINITY);
  }
}
