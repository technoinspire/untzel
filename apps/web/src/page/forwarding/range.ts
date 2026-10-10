// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range's intents of the deferred port: forwarded to the running
// controls once the engine runs, dropped before. Part of the initial JS: types only.
import type { RangeIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardRange(running: () => RunningControls | null): RangeIntents {
  return {
    setPlayRange: (startBar, endBar, gesture) => running()?.range.setPlayRange(startBar, endBar, gesture),
    clearPlayRange: () => running()?.range.clearPlayRange(),
    setRangeCycle: (cycle) => running()?.range.setRangeCycle(cycle),
    setRangeToPart: (part) => running()?.range.setRangeToPart(part),
    extendRangeToPart: (part) => running()?.range.extendRangeToPart(part),
    playFrom: (bar) => running()?.range.playFrom(bar),
    playFromPart: (part) => running()?.range.playFromPart(part),
    playPart: (part) => running()?.range.playPart(part),
  };
}
