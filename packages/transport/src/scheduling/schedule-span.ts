// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  add,
  compare,
  frameAt,
  mul,
  rational,
  sub,
  type Rational,
  type TempoOrigin,
} from "@untzel/core";
import { ceilBar } from "./bars";
import type { CompiledProgram } from "./compiled-program";
import {
  SIGNAL_POINTS_PER_BAR,
  applyGainFactor,
  parameterValueAt,
  signalParameters,
} from "./signal-sampler";
import type { ParameterPoint, ScheduledEvent } from "../types";

/** What is fixed while one span inside a single bar is scheduled. */
export interface SpanContext {
  readonly compiled: CompiledProgram;
  readonly origin: TempoOrigin;
  readonly generation: number;
  /** Tracks of the current section in song mode; null in loop mode (every track). */
  readonly members: ReadonlySet<string> | null;
  /** Section.gain in song mode, 1 in loop mode. */
  readonly sectionGain: number;
  /** Bar where the signal phase is 0: play (loop) or the start of the part (song). */
  readonly phaseStart: Rational;
  /** Bar where every pattern reads its bar 0: the pass of a written loop, else 0. */
  readonly patternStart: Rational;
  /** Bar, on the timeline shifted by patternStart, where every pattern cycle starts:
   * 0 in loop mode, the part start in song mode (where patternStart is 0). */
  readonly cycleOrigin: Rational;
}

export interface SpanOutput {
  readonly events: ScheduledEvent[];
  readonly points: ParameterPoint[];
}

const SIGNAL_STEP = rational(1n, BigInt(SIGNAL_POINTS_PER_BAR));

/**
 * Schedules [begin, end), which must lie inside one bar: events of the tracks that
 * play, and signal points of every track (a track outside the section keeps its tail
 * and its parameters moving).
 */
// Over 40 lines: realtime scheduling, run for every span of every tick; one pass over the tracks keeps it allocation-light.
export function scheduleSpan(
  context: SpanContext,
  begin: Rational,
  end: Rational,
  output: SpanOutput,
): void {
  const { program, patterns } = context.compiled;
  // Over 40 lines: the per-track body of scheduleSpan, on the same hot path.
  program.tracks.forEach((track, trackIndex) => {
    const inSection = context.members === null || context.members.has(track.name);
    if (inSection && !track.muted) {
      const span = { begin: sub(begin, context.patternStart), end: sub(end, context.patternStart) };
      for (const event of patterns[trackIndex]?.query(span, context.cycleOrigin) ?? []) {
        const at = add(event.begin, context.patternStart);
        const frame = frameAt(context.origin, at);
        const endFrame = frameAt(context.origin, add(at, event.duration));
        output.events.push({
          frame,
          durationFrames: Math.max(1, endFrame - frame),
          generation: context.generation,
          trackIndex,
          value: event.value,
          velocity: event.velocity,
          source: event.source,
        });
      }
    }
    const gainFactor = inSection && context.members !== null ? context.sectionGain : 1;
    for (const parameter of signalParameters(track)) {
      for (const at of signalPointBars(begin, end)) {
        const frame = frameAt(context.origin, at);
        const value = parameterValueAt(
          parameter,
          sub(at, context.phaseStart),
          program.sourceHash,
          track.name,
        );
        output.points.push({
          frame,
          generation: context.generation,
          trackIndex,
          parameter: parameter.index,
          value: applyGainFactor(parameter.index, value, gainFactor),
          rampFrames: frameAt(context.origin, add(at, SIGNAL_STEP)) - frame,
          isConstant: false,
        });
      }
    }
  });
}

/** Multiples of 1/16 bar inside [begin, end). */
function signalPointBars(begin: Rational, end: Rational): Rational[] {
  const first = ceilBar(mul(begin, rational(BigInt(SIGNAL_POINTS_PER_BAR), 1n)));
  const bars: Rational[] = [];
  for (let step = first; ; step += 1) {
    const at = rational(BigInt(step), BigInt(SIGNAL_POINTS_PER_BAR));
    if (compare(at, end) >= 0) return bars;
    bars.push(at);
  }
}
