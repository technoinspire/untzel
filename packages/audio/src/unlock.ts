// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/**
 * Creates and resumes the AudioContext synchronously, inside the user gesture, before
 * any await. Returns null when Web Audio is missing. Part of the initial JS, so it
 * imports nothing.
 */
export function unlockAudio(): AudioContext | null {
  if (typeof AudioContext !== "function") {
    console.warn("Untzel: this browser has no AudioContext");
    return null;
  }
  const context = new AudioContext({ latencyHint: "interactive" });
  // The promise settles later; start() reads context.state to tell "blocked" apart.
  context.resume().catch((error: unknown) => console.warn("Untzel: resume() rejected", error));
  return context;
}

/** AudioWorklet and WebAssembly are both required; checked before the first tap. */
export function canPlay(): boolean {
  return (
    typeof AudioContext === "function" &&
    typeof AudioWorkletNode === "function" &&
    typeof WebAssembly === "object"
  );
}
