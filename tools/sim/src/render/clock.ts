// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The clock that times renders. "wall" is elapsed time (what a phone's audio thread has).
// "cpu" is the CPU time of this thread only: on a loaded machine, wall time also counts
// the time other processes held the core, while the CPU time of the render stays close
// to what it costs on a calm one. Budgets measured here say which clock they used.
import { performance } from "node:perf_hooks";

export type ClockKind = "wall" | "cpu";

export const CLOCK_KINDS: readonly ClockKind[] = ["wall", "cpu"];

/** Milliseconds; only differences between two readings mean anything. */
export function clockOf(kind: ClockKind): () => number {
  if (kind === "wall") return () => performance.now();
  return () => {
    const usage = process.threadCpuUsage();
    return (usage.user + usage.system) / 1000;
  };
}
