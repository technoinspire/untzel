// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { SheetDrag } from "./sheet-drag";

const HEIGHT = 600;

/** Moves slowly (1 px per 10 ms) from 100 to 100 + distance, then waits before release. */
function slowDrag(distance: number, pauseMs = 200): { drag: SheetDrag; end: ReturnType<SheetDrag["up"]> } {
  const drag = new SheetDrag();
  drag.down(100, 0, HEIGHT);
  let time = 0;
  for (let step = 1; step <= distance; step += 1) {
    time += 10;
    drag.move(100 + step, time);
  }
  return { drag, end: drag.up(100 + distance, time + pauseMs) };
}

describe("SheetDrag", () => {
  it("follows the finger down after the slop, never up", () => {
    const drag = new SheetDrag();
    drag.down(100, 0, HEIGHT);
    expect(drag.move(105, 10)).toBeNull();
    expect(drag.move(140, 20)).toBe(40);
    expect(drag.move(60, 30)).toBe(0);
  });

  it("closes past 30% of the height", () => {
    expect(slowDrag(181).end).toBe("close");
  });

  it("snaps back from a short slow drag", () => {
    expect(slowDrag(120).end).toBe("snap-back");
  });

  it("closes on a fast downward flick even when short", () => {
    const drag = new SheetDrag();
    drag.down(100, 0, HEIGHT);
    drag.move(130, 20);
    drag.move(170, 40);
    expect(drag.up(170, 45)).toBe("close");
  });

  it("does not count a flick the finger stopped before lifting", () => {
    expect(slowDrag(60, 150).end).toBe("snap-back");
  });

  it("ignores a press that never moved past the slop (a tap)", () => {
    const drag = new SheetDrag();
    drag.down(100, 0, HEIGHT);
    drag.move(104, 10);
    expect(drag.up(104, 20)).toBe("none");
  });

  it("snaps back when the drag is cancelled", () => {
    const drag = new SheetDrag();
    drag.down(100, 0, HEIGHT);
    drag.move(200, 50);
    expect(drag.cancel()).toBe("snap-back");
    expect(drag.isDragging).toBe(false);
  });
});
