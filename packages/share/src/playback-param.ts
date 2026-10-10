// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What travels beside the text of a link or a file: the sender's mode and the
// play range of that mode, as `mode=song range=9-28 cycle=off`. The range only
// goes with its mode, because bars alone do not say which ruler they count on; `cycle`
// only goes when off. Reading ignores unknown keys and malformed values, so a link or a
// file made before either parameter opens exactly as it did.
import type { PlaybackMode, PlayRange } from "@untzel/session";
import { modeParam, readModeParam } from "./mode-param";

const RANGE_KEY = "range";
const CYCLE_KEY = "cycle";
const RANGE_VALUE = /^([1-9][0-9]{0,3})-([1-9][0-9]{0,3})$/;

export interface CarriedPlayback {
  readonly mode: PlaybackMode | null;
  /** The play range of `mode`; always null without a mode. */
  readonly range: PlayRange | null;
}

/** The `key=value` pairs, in order; empty without a mode. */
export function playbackParams(mode: PlaybackMode | null, range: PlayRange | null): readonly string[] {
  if (mode === null) return [];
  const pairs = [modeParam(mode)];
  if (range === null) return pairs;
  pairs.push(`${RANGE_KEY}=${range.startBar}-${range.endBar}`);
  if (mode === "song" && !range.cycle) pairs.push(`${CYCLE_KEY}=off`);
  return pairs;
}

/** The mode and its range among `key=value` pairs; the last valid value of each wins. */
export function readPlaybackParams(pairs: readonly string[]): CarriedPlayback {
  const mode = readModeParam(pairs);
  if (mode === null) return { mode, range: null };
  let bars: { readonly startBar: number; readonly endBar: number } | null = null;
  let cycle = true;
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const key = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (key === RANGE_KEY) bars = barsOf(value) ?? bars;
    if (key === CYCLE_KEY && (value === "on" || value === "off")) cycle = value === "on";
  }
  // The loop always repeats: a `cycle` beside a loop range means nothing.
  return { mode, range: bars === null ? null : { ...bars, cycle: mode === "loop" || cycle } };
}

function barsOf(value: string): { readonly startBar: number; readonly endBar: number } | null {
  const match = RANGE_VALUE.exec(value);
  if (match === null) return null;
  const startBar = Number(match[1]);
  const endBar = Number(match[2]);
  return startBar <= endBar ? { startBar, endBar } : null;
}
