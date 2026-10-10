// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The tap's audio: the context is created or resumed synchronously, inside the
// gesture, before any await, and the first-sound clock starts there. Part of the initial JS.
import { unlockAudio } from "@untzel/audio/unlock";

export interface AudioGesture {
  /** Inside the tap, first: unlocks the context and starts the first-sound clock; null without Web Audio. */
  tap(): AudioContext | null;
  /** performance.now() of the last tap. */
  tappedAt(): number | null;
  /** performance.now() when the tapped context first reported "running" (frame 0). */
  runningAt(): number | null;
  /** A start that failed: the next tap makes a new context. */
  forget(): void;
}

/** A new context the first time and after a close or a failure; else the same one, resumed. */
function unlockInGesture(context: AudioContext | null): AudioContext | null {
  if (context === null || context.state === "closed") return unlockAudio();
  context.resume().catch((error: unknown) => console.warn("Untzel: resume() rejected", error));
  return context;
}

/** Frame 0 of the first-sound estimate: when the context reports "running". */
function watchRunning(unlocked: AudioContext, onRunning: (at: number) => void): void {
  if (unlocked.state === "running") {
    onRunning(performance.now());
    return;
  }
  const onChange = (): void => {
    if (unlocked.state !== "running") return;
    onRunning(performance.now());
    unlocked.removeEventListener("statechange", onChange);
  };
  unlocked.addEventListener("statechange", onChange);
}

export function createAudioGesture(): AudioGesture {
  let context: AudioContext | null = null;
  let tappedAt: number | null = null;
  let runningAt: number | null = null;
  return {
    tap: () => {
      tappedAt = performance.now();
      context = unlockInGesture(context);
      const unlocked = context;
      if (unlocked !== null) {
        runningAt = null;
        watchRunning(unlocked, (at) => (runningAt = at));
      }
      return unlocked;
    },
    tappedAt: () => tappedAt,
    runningAt: () => runningAt,
    forget: () => {
      context = null;
    },
  };
}
