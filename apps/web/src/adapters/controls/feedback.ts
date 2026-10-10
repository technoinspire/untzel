// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// What the page tells the person after a gesture: the aria-live announcement and the
// editor's "Line N changed" notice. Shared by every group of controls.

import type { InterfaceChange } from "@untzel/editor";
import type { CommandResult, NamedCommandResult, Session, Unsubscribe } from "@untzel/session";
import { announcements } from "../../strings/copy";
import type { InterfaceChanges } from "../code-port";

type Listener<T> = (value: T) => void;

export class ControlsFeedback implements InterfaceChanges {
  readonly #session: Session;
  readonly #announcementListeners = new Set<Listener<string>>();
  readonly #changeListeners = new Set<Listener<InterfaceChange>>();
  #changeId = 0;
  #lastChange: InterfaceChange | null = null;

  constructor(session: Session) {
    this.#session = session;
  }

  announce(message: string): void {
    for (const listener of this.#announcementListeners) listener(message);
  }

  onAnnouncement(listener: Listener<string>): Unsubscribe {
    this.#announcementListeners.add(listener);
    return () => this.#announcementListeners.delete(listener);
  }

  /** True when the command ran; a failure is announced with its code. */
  report(result: CommandResult | NamedCommandResult): boolean {
    if (!result.ok) this.announce(announcements.failed(result.code));
    return result.ok;
  }

  /** An edit made on the person's behalf, at the track's line after the edit. */
  noteChange(track: string, what: string, value: string): void {
    const line = this.#session.view().tracks.find((entry) => entry.name === track)?.line ?? 1;
    this.#changeId += 1;
    const change = { id: this.#changeId, line, message: announcements.lineChanged(line, track, what, value) };
    this.#lastChange = change;
    for (const listener of this.#changeListeners) listener(change);
  }

  lastChange(): InterfaceChange | null {
    return this.#lastChange;
  }

  onInterfaceChange(listener: Listener<InterfaceChange>): Unsubscribe {
    this.#changeListeners.add(listener);
    return () => this.#changeListeners.delete(listener);
  }
}
