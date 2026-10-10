// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Arrangement } from "./arrangement";
import { loopSectionOf } from "./loop";
import type { Program } from "../program/program";
import { compare, rational } from "./rational";
import { createOrigin, retempo, type TempoOrigin } from "./tempo-origin";

const ZERO = rational(0n, 1n);

/**
 * The tempo origin that a play from bar 0, with bar 0 at frame 0, would have at `bar`.
 * Loop: one origin at the loop section's tempo, or the program tempo. Song: the chain of retempos at every part start
 * from 0 up to `bar`, each part at its section tempo (or the program tempo), exactly as
 * the transport does at its bar boundaries. A song that does not loop stops at its end.
 */
export function originAtBar(
  program: Program,
  arrangement: Arrangement | null,
  mode: "loop" | "song",
  bar: number,
  sampleRate: number,
): TempoOrigin {
  if (mode === "loop") {
    return createOrigin(ZERO, 0, loopSectionOf(program)?.tempo ?? program.tempo, sampleRate);
  }
  if (arrangement === null) return createOrigin(ZERO, 0, program.tempo, sampleRate);
  const tempoOf = (partIndex: number) =>
    arrangement.parts[partIndex]?.section.tempo ?? program.tempo;
  let origin = createOrigin(ZERO, 0, tempoOf(0), sampleRate);
  const passes = arrangement.loops ? Math.floor(bar / arrangement.totalBars) : 0;
  for (let pass = 0; pass <= passes; pass += 1) {
    for (let index = 0; index < arrangement.parts.length; index += 1) {
      const part = arrangement.parts[index];
      if (part === undefined) continue;
      const start = pass * arrangement.totalBars + part.start;
      if (start === 0) continue;
      if (start > bar) return origin;
      const tempo = tempoOf(index);
      if (compare(tempo, origin.tempo) !== 0) {
        origin = retempo(origin, rational(BigInt(start), 1n), tempo, sampleRate);
      }
    }
  }
  return origin;
}
