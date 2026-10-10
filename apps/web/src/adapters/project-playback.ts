// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The open project's mode and play range on this device. A change of only them
// rewrites only them, after the text save in flight, and the next text save waits for that
// write, so neither undoes the other. A playback equal to the one stored writes nothing.
import type { ProjectLibrary, ProjectPlayback } from "@untzel/session/projects";

export class ProjectPlaybackWriter {
  #stored = "";
  #writing: Promise<unknown> = Promise.resolve();

  /** The playback the project opened with, or was just saved with. */
  remember(playback: ProjectPlayback | null): void {
    this.#stored = playbackKey(playback);
  }

  /** Settles once the playback-only write in flight is done, stored or refused. */
  get writing(): Promise<unknown> {
    return this.#writing;
  }

  /** Writes `playback` into project `id` after `after`, when it differs from the one stored. */
  write(library: Pick<ProjectLibrary, "setPlayback">, id: string, playback: ProjectPlayback, after: Promise<unknown>): void {
    const key = playbackKey(playback);
    if (key === this.#stored) return;
    this.#stored = key;
    this.#writing = after
      .then(() => library.setPlayback(id, playback))
      .catch((error: unknown) => console.warn("projects: the play range was not saved on this device", error));
  }
}

/** A playback as a string, to tell whether it changed since it was stored. */
function playbackKey(playback: ProjectPlayback | null): string {
  if (playback === null) return "";
  const range = playback.range;
  return range === null ? playback.mode : `${playback.mode} ${range.startBar}-${range.endBar} ${range.cycle}`;
}
