// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The name rule and the pattern rule of the language, for the controls to anticipate
// them (they never import language), without the parser (initial JS budget).

export { canPlay, checkName, type NameProblem, type PatternContent } from "@untzel/language/rules";
// The play range's snap and clamp, for the ruler to follow a finger by bars.
export { clampPlayRange, snapToBar, type PlayRange } from "@untzel/transport/play-range";
// The export's stretch: ticks of 1/64 bar, snapped to steps, capped per format.
export {
  TICKS_PER_BAR,
  barBeatOf,
  barBeatLabel,
  gridTicks,
  moveStretchHandle,
  secondsAtTick,
  stretchKeyTick,
  stretchSeconds,
  type ExportStretch,
  type StretchHandle,
  type TimeMap,
} from "@untzel/transport/export-stretch";
