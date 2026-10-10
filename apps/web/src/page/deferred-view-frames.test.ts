// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The running music's changes reach the screens once per animation frame; the
// page's own changes (phase, notices, the waiting stage) draw at once.
import { describe, expect, it } from "vitest";
import type { UntzelView } from "@untzel/presentation/view-model";
import type { RunningControls } from "../adapters/session-controls-port";
import { DeferredControlsPort } from "./deferred-controls-port";
import type { FrameScheduler } from "./frame-coalescer";

class FakeFrames implements FrameScheduler {
  readonly pending = new Map<number, () => void>();
  #next = 1;
  request(run: () => void): number {
    const id = this.#next++;
    this.pending.set(id, run);
    return id;
  }
  cancel(id: number): void {
    this.pending.delete(id);
  }
  frame(): void {
    const due = [...this.pending.values()];
    this.pending.clear();
    for (const run of due) run();
  }
}

function setup() {
  const frames = new FakeFrames();
  const changeListeners = new Set<() => void>();
  let described = 0;
  const running = {
    view: {
      view: () => {
        described += 1;
        return { phase: "running" } as unknown as UntzelView;
      },
      onChange: (listener: () => void) => {
        changeListeners.add(listener);
        return () => changeListeners.delete(listener);
      },
      onAnnouncement: () => () => undefined,
    },
  } as unknown as RunningControls;
  const port = new DeferredControlsPort({
    phase: "idle",
    templates: { blank: null, styles: [], projects: [] },
    choice: { template: "onboard", openStyle: null },
    actions: { start: () => undefined, retry: () => undefined, openFile: () => undefined, projects: {} as never, saveWaitingFile: () => undefined },
    frames,
  });
  const renders: UntzelView[] = [];
  port.subscribe((view) => renders.push(view));
  port.attach(running);
  port.setPhase("running");
  renders.length = 0;
  described = 0;
  const change = (): void => {
    for (const listener of changeListeners) listener();
  };
  return { port, frames, renders, change, described: () => described };
}

describe("DeferredControlsPort, one view per frame", () => {
  it("draws many changes of the music once, on the next frame", () => {
    const { frames, renders, change, described } = setup();
    for (let i = 0; i < 5; i += 1) change();
    expect(renders).toHaveLength(0);
    expect(described()).toBe(0);
    frames.frame();
    expect(renders).toHaveLength(1);
    expect(described()).toBe(1);
  });
  it("draws a page change at once and drops the frame it made redundant", () => {
    const { port, frames, renders, change } = setup();
    change();
    port.announce("x");
    port.notice(null);
    expect(renders).toHaveLength(1);
    frames.frame();
    expect(renders).toHaveLength(1);
  });
  it("draws what is pending before an input, so its views answer from the newest model", () => {
    const { port, frames, renders, change } = setup();
    change();
    port.drawPending();
    expect(renders).toHaveLength(1);
    port.drawPending();
    frames.frame();
    expect(renders).toHaveLength(1);
  });
  it("draws nothing after detach", () => {
    const { port, frames, renders, change } = setup();
    change();
    port.detach();
    frames.frame();
    expect(renders).toHaveLength(0);
  });
});
