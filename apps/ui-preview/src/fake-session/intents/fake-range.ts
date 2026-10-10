// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range of the fake session: one range per mode, as the preview draws it;
// it does not move the fake music.

import type { RangeIntents } from "@untzel/skin-contract";
import type { PlayRangeValue } from "@untzel/presentation/view-model";
import type { FakeState } from "../fake-state";

function partRange(state: FakeState, part: number): PlayRangeValue | null {
  const entry = state.parts[part];
  return entry === undefined ? null : { startBar: entry.start + 1, endBar: entry.start + entry.bars, cycle: true };
}

function setRange(state: FakeState, range: PlayRangeValue | null): void {
  state.ranges[state.mode] = range;
  state.emit();
}

function extendRangeToPart(state: FakeState, part: number): void {
  const range = state.ranges[state.mode];
  const target = partRange(state, part);
  if (target === null || range === null) return setRange(state, target);
  setRange(state, { startBar: Math.min(range.startBar, target.startBar), endBar: Math.max(range.endBar, target.endBar), cycle: range.cycle });
}

function playFrom(state: FakeState, bar: number): void {
  const range = state.ranges[state.mode];
  setRange(state, { startBar: bar, endBar: range?.endBar ?? bar, cycle: range?.cycle ?? true });
}

function setRangeCycle(state: FakeState, cycle: boolean): void {
  const range = state.ranges[state.mode];
  if (range !== null) setRange(state, { ...range, cycle });
}

function playFromPart(state: FakeState, part: number): void {
  const target = partRange(state, part);
  if (target !== null) playFrom(state, target.startBar);
}

export function fakeRange(state: FakeState): RangeIntents {
  return {
    setPlayRange: (startBar, endBar) => setRange(state, { startBar, endBar, cycle: state.ranges[state.mode]?.cycle ?? true }),
    clearPlayRange: () => setRange(state, null),
    setRangeCycle: (cycle) => setRangeCycle(state, cycle),
    setRangeToPart: (part) => setRange(state, partRange(state, part)),
    extendRangeToPart: (part) => extendRangeToPart(state, part),
    playFrom: (bar) => playFrom(state, bar),
    playFromPart: (part) => playFromPart(state, part),
    playPart: (part) => setRange(state, partRange(state, part)),
  };
}
