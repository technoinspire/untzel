// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/** Anything with a tick, so the helper does not import the Transport class itself. */
export interface Tickable {
  tick(): void;
}

/** The part of FakeClock the helper moves. */
export interface ManualClock {
  readonly sampleRate: number;
  nowFrame(): number | null;
  set(frame: number): void;
}

/**
 * Advances the clock and ticks until `untilFrame`. `intervalMs` gives each gap between
 * ticks (the worker's 25 ms timer plus jitter); a constant 25 ms by default.
 */
export function driveClock(
  transport: Tickable,
  clock: ManualClock,
  untilFrame: number,
  intervalMs: () => number = () => 25,
): void {
  for (;;) {
    const now = clock.nowFrame() ?? 0;
    if (now >= untilFrame) return;
    clock.set(now + Math.max(1, Math.round((intervalMs() * clock.sampleRate) / 1000)));
    transport.tick();
  }
}
