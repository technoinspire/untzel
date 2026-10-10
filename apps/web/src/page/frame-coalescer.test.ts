// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { FrameCoalescer, animationFrames, type FrameScheduler } from "./frame-coalescer";

class FakeFrames implements FrameScheduler {
  readonly pending = new Map<number, () => void>();
  requests = 0;
  #next = 1;
  request(run: () => void): number {
    this.requests += 1;
    const id = this.#next++;
    this.pending.set(id, run);
    return id;
  }
  cancel(id: number): void {
    this.pending.delete(id);
  }
  /** The next animation frame. */
  frame(): void {
    const due = [...this.pending.values()];
    this.pending.clear();
    for (const run of due) run();
  }
}

describe("FrameCoalescer", () => {
  it("runs once per frame, the latest scheduled run, however many asked", () => {
    const frames = new FakeFrames();
    const coalescer = new FrameCoalescer(frames);
    const ran: string[] = [];
    for (const name of ["a", "b", "c"]) coalescer.schedule(() => ran.push(name));
    expect(frames.requests).toBe(1);
    expect(ran).toEqual([]);
    frames.frame();
    expect(ran).toEqual(["c"]);
  });
  it("asks for a new frame when scheduled after the last one ran", () => {
    const frames = new FakeFrames();
    const coalescer = new FrameCoalescer(frames);
    let runs = 0;
    coalescer.schedule(() => (runs += 1));
    frames.frame();
    coalescer.schedule(() => (runs += 1));
    expect(frames.requests).toBe(2);
    frames.frame();
    expect(runs).toBe(2);
  });
  it("runs nothing once cancelled, and schedules again afterwards", () => {
    const frames = new FakeFrames();
    const coalescer = new FrameCoalescer(frames);
    let runs = 0;
    coalescer.schedule(() => (runs += 1));
    coalescer.cancel();
    frames.frame();
    expect(runs).toBe(0);
    coalescer.schedule(() => (runs += 1));
    frames.frame();
    expect(runs).toBe(1);
  });
  it("flushes the pending run now, once, and leaves nothing for the frame", () => {
    const frames = new FakeFrames();
    const coalescer = new FrameCoalescer(frames);
    let runs = 0;
    coalescer.flush();
    expect(runs).toBe(0);
    coalescer.schedule(() => (runs += 1));
    coalescer.flush();
    expect(runs).toBe(1);
    frames.frame();
    expect(runs).toBe(1);
  });
  it("wraps the window's animation frames", () => {
    const calls: string[] = [];
    const scheduler = animationFrames({
      requestAnimationFrame: (callback) => {
        calls.push("request");
        callback(0);
        return 7;
      },
      cancelAnimationFrame: (id) => calls.push(`cancel ${id}`),
    });
    let ran = false;
    expect(scheduler.request(() => (ran = true))).toBe(7);
    scheduler.cancel(7);
    expect(ran).toBe(true);
    expect(calls).toEqual(["request", "cancel 7"]);
  });
});
