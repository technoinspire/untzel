// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { BarIntents, MixIntents, TrackIntents } from "@untzel/skin-contract";
import type { StepPitch } from "@untzel/core";
import { isTrackMuted } from "@untzel/presentation";
import type { Session, TrackEdits, TrackView } from "@untzel/session";
import { announcements } from "../../strings/copy";
import type { ControlsFeedback } from "./feedback";
import { GestureCoalescer } from "./gesture-coalescer";

export interface TrackControlsOptions {
  readonly session: Session;
  readonly edits: TrackEdits;
  readonly feedback: ControlsFeedback;
  readonly coalescer?: GestureCoalescer;
}

/**
 * Tiles, the track detail and the track table. Step intents carry the bar picked in the
 * track detail. Rules about values, notes and lengths live in TrackEdits.
 */
export class TrackControls implements TrackIntents, BarIntents, MixIntents {
  readonly #session: Session;
  readonly #edits: TrackEdits;
  readonly #feedback: ControlsFeedback;
  readonly #coalescer: GestureCoalescer;
  /** Elements of the last copied bar, for Paste here. */
  #clipboard: string | null = null;

  constructor(options: TrackControlsOptions) {
    this.#session = options.session;
    this.#edits = options.edits;
    this.#feedback = options.feedback;
    this.#coalescer = options.coalescer ?? new GestureCoalescer();
  }

  toggleTrack(track: string): void {
    const before = this.#track(track);
    if (!this.#feedback.report(this.#edits.toggleTrack(track)) || before === undefined) return;
    this.#feedback.announce(announcements.trackOnNextBar(track, before.muted));
    this.#feedback.noteChange(track, "mute", before.muted ? "off" : "on");
  }

  setSolo(track: string, isSoloed: boolean): void {
    const current = this.#session.view().solo;
    this.#session.solo(isSoloed ? track : current === track ? null : current);
  }

  setMute(track: string, isMuted: boolean): void {
    const current = this.#track(track);
    if (current === undefined || isTrackMuted(current, this.#session.view().mode ?? "loop") === isMuted) return;
    this.toggleTrack(track);
  }

  setTone(track: string, tone: number): void {
    this.setParameter(track, "tone", tone);
  }

  toggleStep(track: string, bar: number, step: number): void {
    if (this.#feedback.report(this.#edits.toggleStep(track, bar, step))) this.#noteStep(track, bar, step);
  }

  /** The note picker's Choose: one edit; the "Line N changed" notice names the step. */
  setStepPitch(track: string, bar: number, step: number, pitch: StepPitch): void {
    if (this.#feedback.report(this.#edits.setStepPitch(track, bar, step, pitch))) this.#noteStep(track, bar, step);
  }

  setScaleLock(track: string, isLocked: boolean): void {
    if (this.#feedback.report(this.#edits.setScaleLock(track, isLocked))) {
      this.#feedback.noteChange(track, "scale lock", isLocked ? "on" : "off (free)");
    }
  }

  /** 8, 16 or 32 steps in every bar of the track, on the next bar. */
  setStepCount(track: string, count: number): void {
    if (this.#feedback.report(this.#edits.setStepCount(track, count))) {
      this.#feedback.noteChange(track, "steps", String(count));
    }
  }

  /**
   * 1..16 bars; new bars repeat the last one, so nothing goes silent. A written loop
   * shorter than the pattern grows in the same edit (TrackEdits), and the person hears it
   * said, as when they pick the loop length themselves.
   */
  setBars(track: string, bars: number): void {
    const before = this.#session.view().loop;
    if (!this.#feedback.report(this.#edits.setTrackBars(track, bars))) return;
    this.#feedback.noteChange(track, "bars", String(bars));
    const loop = this.#session.view().loop;
    if (before?.declared === true && loop !== null && loop.bars > before.bars) this.#feedback.announce(announcements.loopLength(loop.bars));
  }

  /**
   * Copy bar: the elements as written now. The copy lives here, not in the text: it is a
   * clipboard, not music, and later edits of the copied bar do not change it.
   */
  copyBar(track: string, bar: number): boolean {
    const text = this.#edits.readBar(track, bar);
    if (text === null) return false;
    this.#clipboard = text;
    this.#feedback.announce(announcements.barCopied(track, bar + 1));
    return true;
  }

  /** Paste here: one edit; the "Line N changed" notice names the bar. */
  pasteBar(track: string, bar: number): void {
    if (this.#clipboard === null) return;
    if (this.#feedback.report(this.#edits.pasteBar(track, bar, this.#clipboard))) {
      this.#feedback.noteChange(track, `bar ${bar + 1}`, this.#clipboard);
      this.#feedback.announce(announcements.barPasted(track, bar + 1));
    }
  }

  clearBar(track: string, bar: number): void {
    if (this.#feedback.report(this.#edits.clearBar(track, bar))) {
      this.#feedback.noteChange(track, `bar ${bar + 1}`, "rests");
      this.#feedback.announce(announcements.barCleared(track, bar + 1));
    }
  }

  /** Sliders and drags: one edit per pause, so a drag is one line change. */
  setParameter(track: string, parameter: string, fraction: number): void {
    this.#coalescer.schedule(`${track}|${parameter}`, () => {
      const result = this.#edits.setParamFraction(track, parameter, fraction);
      if (this.#feedback.report(result) && result.ok) this.#feedback.noteChange(track, parameter, String(result.value));
    });
  }


  /** Renames the track with every section; a soloed track stays soloed. */
  renameTrack(track: string, newName: string): void {
    if (this.#feedback.report(this.#edits.renameTrack(track, newName))) this.#feedback.noteChange(newName, "name", newName);
  }

  /** Use Tone: the written parameters that override tone leave the text. */
  useTone(track: string): readonly string[] {
    const result = this.#edits.useTone(track);
    if (!this.#feedback.report(result) || !result.ok) return [];
    if (result.removed.length > 0) this.#feedback.noteChange(track, "tone", `${result.removed.join(", ")} removed`);
    return result.removed;
  }

  nudgeGain(track: string, steps: number): void {
    this.#coalescer.flushAll();
    const result = this.#edits.nudgeGain(track, steps);
    if (this.#feedback.report(result) && result.ok) this.#feedback.noteChange(track, "gain", String(result.value));
  }

  resetGain(track: string): void {
    this.#coalescer.flushAll();
    if (this.#feedback.report(this.#edits.resetGain(track))) this.#feedback.noteChange(track, "gain", "1");
  }

  /** A drag ended: its last value is written now and the next gesture is a step of its own. */
  endGesture(): void {
    this.#coalescer.flushAll();
    this.#session.endGesture();
  }

  duplicateTrack(track: string): string {
    const result = this.#edits.duplicateTrack(track);
    if (!this.#feedback.report(result) || !result.ok) return track;
    this.#feedback.announce(announcements.trackAdded(result.name));
    return result.name;
  }

  deleteTrack(track: string): void {
    if (this.#feedback.report(this.#edits.deleteTrack(track))) this.#feedback.announce(announcements.trackDeleted(track));
  }

  /** Pending drags are dropped: the page is going away. */
  dispose(): void {
    this.#coalescer.cancelAll();
  }

  #track(name: string): TrackView | undefined {
    return this.#session.view().tracks.find((track) => track.name === name);
  }

  /** The step as the text now writes it ("x", ".", "eb2"), for the "Line N changed" notice. */
  #noteStep(track: string, bar: number, step: number): void {
    const view = this.#session.view();
    const cell = view.tracks.find((entry) => entry.name === track)?.bars[bar]?.[step];
    const text = cell === undefined ? "?" : view.source.slice(cell.source.from, cell.source.to);
    this.#feedback.noteChange(track, bar === 0 ? `step ${step + 1}` : `bar ${bar + 1} step ${step + 1}`, text);
  }
}
