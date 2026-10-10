// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { PlaybackMode } from "@untzel/session";
import type { MainToWorkerMessage } from "../protocol";

type BackgroundMessage = Extract<MainToWorkerMessage, { readonly type: "background" }>;
type LoadMessage = Extract<MainToWorkerMessage, { readonly type: "load" }>;
type PlayRangeMessage = Extract<MainToWorkerMessage, { readonly type: "setPlayRange" }>;

const MODES: readonly PlaybackMode[] = ["loop", "song"];

/**
 * The last state the worker was told, to say it again: a take that starts while
 * the music plays records the state first, as plain commands, so its replay needs nothing
 * from before it. Shared by every sound port that talks to a transport host.
 */
export class CommandLog {
  #background: BackgroundMessage | null = null;
  #load: LoadMessage | null = null;
  readonly #ranges = new Map<PlaybackMode, PlayRangeMessage>();

  /** Every message on its way to the worker passes here (references, no copy). */
  note(message: MainToWorkerMessage): void {
    switch (message.type) {
      case "background":
        this.#background = message;
        return;
      case "load":
        this.#load = message;
        return;
      case "setPlayRange":
        this.#ranges.set(message.change.mode, message);
        return;
      default:
        return;
    }
  }

  /**
   * background, load and the play range of each mode, as plain messages, in that order.
   * A play range is always reaffirmed with locate: false, so it never asks for a jump.
   */
  reaffirmation(): readonly MainToWorkerMessage[] {
    const ranges = MODES.flatMap((mode): MainToWorkerMessage[] => {
      const message = this.#ranges.get(mode);
      return message === undefined ? [] : [{ type: "setPlayRange", change: { ...message.change, locate: false } }];
    });
    return [...(this.#background === null ? [] : [this.#background]), ...(this.#load === null ? [] : [this.#load]), ...ranges];
  }
}
