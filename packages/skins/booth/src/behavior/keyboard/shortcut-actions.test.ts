// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import type { ControlsPort } from "@untzel/skin-contract";
import type { UntzelView } from "@untzel/presentation/view-model";
import { runShortcut, type ShellActions } from "./shortcut-actions";
import { viewFixture } from "../../testing/view-fixture";

function portWith(view: UntzelView, lengths: number[]): ControlsPort {
  // Only what the loop-length shortcut reads and calls.
  return { view: () => view, setLoopBars: (bars: number) => lengths.push(bars) } as unknown as ControlsPort;
}

const shell: ShellActions = { openLibrary: () => undefined, applyNow: () => undefined, dismiss: () => false, toggleControls: () => undefined, announce: () => undefined };
function announcing(said: string[]): ShellActions {
  return { ...shell, announce: (message) => said.push(message) };
}

describe("[ and ]", () => {
  it("step through the musical lengths in loop mode", () => {
    const lengths: number[] = [];
    const loop = viewFixture({ mode: "loop", loopBars: 6 });
    expect(runShortcut({ kind: "loop-length", delta: 1 }, portWith(loop, lengths), shell)).toBe(true);
    expect(runShortcut({ kind: "loop-length", delta: -1 }, portWith(loop, lengths), shell)).toBe(true);
    expect(lengths).toEqual([8, 4]);
  });

  it("do nothing past 16 bars", () => {
    const lengths: number[] = [];
    const said: string[] = [];
    expect(runShortcut({ kind: "loop-length", delta: 1 }, portWith(viewFixture({ mode: "loop", loopBars: 16 }), lengths), announcing(said))).toBe(false);
    expect(lengths).toEqual([]);
    expect(said).toEqual([]);
  });
});
// In Song mode D and [ ] did nothing and said nothing.
describe("D and [ ] in song mode", () => {
  const song = viewFixture({ mode: "song", loopBars: 8 });
  it("[ and ] say once that the loop length works in Loop mode and change nothing", () => {
    const lengths: number[] = [];
    const said: string[] = [];
    expect(runShortcut({ kind: "loop-length", delta: 1 }, portWith(song, lengths), announcing(said))).toBe(true);
    expect(lengths).toEqual([]);
    expect(said).toEqual(["Loop length works in Loop mode."]);
  });
  it("D says once that the drop works in Loop mode and never drops", () => {
    const drops: string[] = [];
    const said: string[] = [];
    const port = { view: () => song, drop: () => drops.push("drop") } as unknown as ControlsPort;
    expect(runShortcut({ kind: "drop" }, port, announcing(said))).toBe(true);
    expect(drops).toEqual([]);
    expect(said).toEqual(["Drop works in Loop mode."]);
  });
  it("D drops in loop mode without a word from the shell", () => {
    const drops: string[] = [];
    const said: string[] = [];
    const port = { view: () => viewFixture({ mode: "loop", loopBars: 8 }), drop: () => drops.push("drop") } as unknown as ControlsPort;
    expect(runShortcut({ kind: "drop" }, port, announcing(said))).toBe(true);
    expect(drops).toEqual(["drop"]);
    expect(said).toEqual([]);
  });
});
