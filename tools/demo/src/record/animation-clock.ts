// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// CSS animations and transitions on the virtual clock.
// Playwright's fake clock moves timers and requestAnimationFrame, not the compositor: a sheet
// would slide in real time while the page waits for the next capture. The DevTools Animation
// domain holds every animation at rate 0, and before each capture puts each one at its
// virtual age: the time since the frame it started on.
/** What this file needs of a CDP session (Playwright's CDPSession satisfies it). */
export interface AnimationProtocol {
  send(method: "Animation.enable" | "Animation.disable"): Promise<unknown>;
  send(method: "Animation.setPlaybackRate", params: { readonly playbackRate: number }): Promise<unknown>;
  send(method: "Animation.seekAnimations", params: { readonly animations: string[]; readonly currentTime: number }): Promise<unknown>;
  send(method: "Animation.releaseAnimations", params: { readonly animations: string[] }): Promise<unknown>;
  on(event: "Animation.animationStarted", listener: (event: AnimationStarted) => void): unknown;
  on(event: "Animation.animationCanceled", listener: (event: { readonly id: string }) => void): unknown;
}

export interface AnimationStarted {
  readonly animation: {
    readonly id: string;
    readonly source?: { readonly delay?: number; readonly duration?: number; readonly iterations?: number; readonly endDelay?: number };
  };
}

interface Held {
  /** The virtual millisecond it started at. */
  readonly startedAt: number;
  /** delay + duration × iterations; Infinity for an endless animation. */
  readonly length: number;
}

/** The time an animation runs: its delay and every iteration. */
export function animationLength(source: AnimationStarted["animation"]["source"]): number {
  const iterations = source?.iterations ?? 1;
  if (!Number.isFinite(iterations)) return Number.POSITIVE_INFINITY;
  return (source?.delay ?? 0) + (source?.duration ?? 0) * iterations + (source?.endDelay ?? 0);
}

export class AnimationClock {
  readonly #protocol: AnimationProtocol;
  readonly #held = new Map<string, Held>();
  #now = 0;
  private constructor(protocol: AnimationProtocol) {
    this.#protocol = protocol;
  }

  /** Freezes the page's animations from now on; `now` is the virtual time in milliseconds. */
  static async hold(protocol: AnimationProtocol, now: number): Promise<AnimationClock> {
    const clock = new AnimationClock(protocol);
    clock.#now = now;
    protocol.on("Animation.animationStarted", ({ animation }) => {
      clock.#held.set(animation.id, { startedAt: clock.#now, length: animationLength(animation.source) });
    });
    protocol.on("Animation.animationCanceled", ({ id }) => clock.#held.delete(id));
    await protocol.send("Animation.enable");
    await protocol.send("Animation.setPlaybackRate", { playbackRate: 0 });
    return clock;
  }

  /** Animations held now. */
  get count(): number {
    return this.#held.size;
  }

  /** Puts every held animation at its age at virtual time `now`; finished ones are let go at their end. */
  async seek(now: number): Promise<void> {
    this.#now = now;
    const byAge = new Map<number, string[]>();
    const finished: string[] = [];
    for (const [id, held] of this.#held) {
      const age = Math.max(0, now - held.startedAt);
      const at = Math.min(age, held.length);
      byAge.set(at, [...(byAge.get(at) ?? []), id]);
      if (age >= held.length) finished.push(id);
    }
    for (const [currentTime, animations] of byAge) {
      await this.#protocol.send("Animation.seekAnimations", { animations, currentTime });
    }
    if (finished.length === 0) return;
    for (const id of finished) this.#held.delete(id);
    await this.#protocol.send("Animation.releaseAnimations", { animations: finished });
  }
}
