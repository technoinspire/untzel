// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The editor's port over the real Session. The editor keeps no text: every keystroke
// goes back through applyText, the same path as a gesture.

import type { CodePort, CodeState, InterfaceChange, TextRange } from "@untzel/editor";
import type { ScheduledBatch, Session, Unsubscribe } from "@untzel/session";

type Listener<T> = (value: T) => void;

/** Lights the token that is sounding, at the time it is heard, not when it was scheduled. */
export class SoundingFeed {
  readonly #contextTime: () => number;
  readonly #listeners = new Set<Listener<readonly TextRange[]>>();
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(contextTime: () => number) {
    this.#contextTime = contextTime;
  }

  push(batch: ScheduledBatch, sampleRate: number, outputLatency: number): void {
    const byFrame = new Map<number, TextRange[]>();
    for (const event of batch.events) {
      const ranges = byFrame.get(event.frame) ?? [];
      ranges.push(event.source);
      byFrame.set(event.frame, ranges);
    }
    for (const [frame, ranges] of byFrame) {
      const delayMs = (frame / sampleRate + outputLatency - this.#contextTime()) * 1000;
      const timer = setTimeout(() => {
        this.#timers.delete(timer);
        this.#emit(ranges);
      }, Math.max(0, delayMs));
      this.#timers.add(timer);
    }
  }

  clear(): void {
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
    this.#emit([]);
  }

  onSounding(listener: Listener<readonly TextRange[]>): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(ranges: readonly TextRange[]): void {
    for (const listener of this.#listeners) listener(ranges);
  }
}

export interface InterfaceChanges {
  lastChange(): InterfaceChange | null;
  onInterfaceChange(listener: Listener<InterfaceChange>): Unsubscribe;
}

export class SessionCodePort implements CodePort {
  readonly #session: Session;
  readonly #changes: InterfaceChanges;
  readonly #sounding: SoundingFeed;

  constructor(session: Session, changes: InterfaceChanges, sounding: SoundingFeed) {
    this.#session = session;
    this.#changes = changes;
    this.#sounding = sounding;
  }

  code(): CodeState {
    const view = this.#session.view();
    // A valid text has only warnings, an invalid one only errors: one list, the session's own
    // array, so an unchanged view compares equal below, and the warnings reach the editor.
    const diagnostics = view.valid ? view.warnings : view.diagnostics;
    const programSource = this.#session.shareableSource()?.source ?? view.source;
    return { source: view.source, programSource, diagnostics, lastChange: this.#changes.lastChange() };
  }

  subscribe(listener: Listener<CodeState>): Unsubscribe {
    let last = this.code();
    const emitIfChanged = (): void => {
      const next = this.code();
      const same = next.source === last.source && next.programSource === last.programSource;
      if (same && next.diagnostics === last.diagnostics && next.lastChange === last.lastChange) {
        return;
      }
      last = next;
      listener(next);
    };
    const unsubscribeSession = this.#session.subscribe(emitIfChanged);
    const unsubscribeChanges = this.#changes.onInterfaceChange(emitIfChanged);
    return () => {
      unsubscribeSession();
      unsubscribeChanges();
    };
  }

  onSounding(listener: Listener<readonly TextRange[]>): Unsubscribe {
    return this.#sounding.onSounding(listener);
  }

  edit(source: string): void {
    if (source !== this.#session.view().source) this.#session.applyText(source);
  }

  applyNow(source: string): void {
    this.edit(source);
  }

  undo(): void {
    this.#session.undo();
  }

  redo(): void {
    this.#session.redo();
  }
}
