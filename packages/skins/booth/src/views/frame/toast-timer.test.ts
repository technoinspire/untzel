// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_TOAST_MS, TOAST_MS } from "./toast";
import { ToastTimer } from "./toast-timer";
const clock = { set: (run: () => void, ms: number) => { const timer = setTimeout(run, ms); return () => clearTimeout(timer); } };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("ToastTimer", () => {
  it("hides after 6 s for a track and 10 s for a project", () => {
    for (const ms of [TOAST_MS, PROJECT_TOAST_MS]) {
      let hidden = 0;
      const timer = new ToastTimer(clock, () => (hidden += 1));
      timer.start(ms);
      vi.advanceTimersByTime(ms - 1);
      expect(hidden).toBe(0);
      vi.advanceTimersByTime(1);
      expect(hidden).toBe(1);
    }
    expect([TOAST_MS, PROJECT_TOAST_MS]).toEqual([6_000, 10_000]);
  });
  it("waits while held and counts again once left", () => {
    let hidden = 0;
    const timer = new ToastTimer(clock, () => (hidden += 1));
    timer.start(PROJECT_TOAST_MS);
    timer.hold(true);
    vi.advanceTimersByTime(60_000);
    expect(hidden).toBe(0);
    timer.hold(false);
    vi.advanceTimersByTime(PROJECT_TOAST_MS - 1);
    expect(hidden).toBe(0);
    vi.advanceTimersByTime(1);
    expect(hidden).toBe(1);
  });
});
