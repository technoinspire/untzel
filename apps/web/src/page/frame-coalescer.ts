// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// One run per animation frame, however many changes asked for it: the
// worker's batches, the position and the stats all land in one view update before the
// paint. A hidden page runs nothing until it shows again, as its frames pause. Before an
// input the page flushes it (input-flush.ts), so a view reads its newest model.

/** The frame clock, injected: requestAnimationFrame on the page, a fake in tests. */
export interface FrameScheduler {
  request(run: () => void): number;
  cancel(id: number): void;
}

export class FrameCoalescer {
  readonly #frames: FrameScheduler;
  #pending: number | null = null;
  #run: (() => void) | null = null;

  constructor(frames: FrameScheduler) {
    this.#frames = frames;
  }

  /** Runs `run` on the next frame; a later call before it replaces it. */
  schedule(run: () => void): void {
    this.#run = run;
    if (this.#pending !== null) return;
    this.#pending = this.#frames.request(() => {
      this.#pending = null;
      const scheduled = this.#run;
      this.#run = null;
      scheduled?.();
    });
  }

  /** Runs what is pending now instead of on the frame. */
  flush(): void {
    const scheduled = this.#run;
    this.cancel();
    scheduled?.();
  }

  /** Drops what is pending: the caller just ran it itself, or is going away. */
  cancel(): void {
    if (this.#pending !== null) this.#frames.cancel(this.#pending);
    this.#pending = null;
    this.#run = null;
  }
}

export function animationFrames(win: Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">): FrameScheduler {
  return {
    request: (run) => win.requestAnimationFrame(() => run()),
    cancel: (id) => win.cancelAnimationFrame(id),
  };
}
