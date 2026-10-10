// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Tile gesture, as a pure state machine:
// tap toggles, vertical drag moves tone, hold solos while held.

export const HOLD_MS = 350;
/** Movement before a press becomes a drag, in CSS pixels. */
export const DRAG_SLOP_PX = 8;
/** A full drag of this many pixels moves tone from 0 to 1. */
export const TONE_RANGE_PX = 160;

export type GestureEffect =
  | { readonly kind: "none" }
  | { readonly kind: "toggle" }
  | { readonly kind: "tone"; readonly tone: number }
  | { readonly kind: "solo"; readonly isSoloed: boolean };

type Phase = "idle" | "pressed" | "dragging" | "holding";

export class TileGesture {
  #phase: Phase = "idle";
  #startY = 0;
  #startTone = 0;

  get isActive(): boolean {
    return this.#phase !== "idle";
  }

  down(y: number, tone: number): GestureEffect {
    this.#phase = "pressed";
    this.#startY = y;
    this.#startTone = tone;
    return { kind: "none" };
  }

  move(y: number): GestureEffect {
    if (this.#phase === "pressed" && Math.abs(y - this.#startY) > DRAG_SLOP_PX) this.#phase = "dragging";
    if (this.#phase !== "dragging") return { kind: "none" };
    const tone = clamp01(this.#startTone + (this.#startY - y) / TONE_RANGE_PX);
    return { kind: "tone", tone };
  }

  /** Called by the shell's timer HOLD_MS after down. */
  hold(): GestureEffect {
    if (this.#phase !== "pressed") return { kind: "none" };
    this.#phase = "holding";
    return { kind: "solo", isSoloed: true };
  }

  up(): GestureEffect {
    const phase = this.#phase;
    this.#phase = "idle";
    if (phase === "pressed") return { kind: "toggle" };
    if (phase === "holding") return { kind: "solo", isSoloed: false };
    return { kind: "none" };
  }

  cancel(): GestureEffect {
    const phase = this.#phase;
    this.#phase = "idle";
    return phase === "holding" ? { kind: "solo", isSoloed: false } : { kind: "none" };
  }
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
