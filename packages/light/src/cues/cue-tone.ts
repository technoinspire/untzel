// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import {
  INSTRUMENT_PARAMETER_OFFSET,
  curvePosition,
  isAcceptedModulator,
  modulatorValueAt,
  type InstrumentManifest,
} from "@untzel/core";
import type { ActivatedTrack, ParameterPoint } from "@untzel/session";
import type { ToneMotion } from "../ports";
// The tone of an event, in this order: (a) a DSP modulator on tone[0] gives its
// value at the event's frame and carries on as the cue's ToneMotion; (b) else the last
// parameter point of that index at or before the frame, along its ramp; (c) else the
// activation's value. A modulator the DSP would refuse is ignored, as the DSP ignores it.

export interface EventTone {
  readonly tone: number;
  readonly toneMotion: ToneMotion | null;
}

/** The last point of each (generation, track, parameter), kept between batches. */
export class ParameterPoints {
  readonly #points = new Map<string, ParameterPoint[]>();

  add(points: readonly ParameterPoint[]): void {
    for (const point of points) {
      const key = `${point.generation}:${point.trackIndex}:${point.parameter}`;
      const list = this.#points.get(key) ?? [];
      list.push(point);
      list.sort((a, b) => a.frame - b.frame);
      // Two are enough to know the value at any frame of the next batch.
      if (list.length > 4) list.splice(0, list.length - 4);
      this.#points.set(key, list);
    }
  }

  /** The value at `frame` from the points, or null when none is at or before it. */
  valueAt(generation: number, trackIndex: number, parameter: number, frame: number): number | null {
    const list = this.#points.get(`${generation}:${trackIndex}:${parameter}`) ?? [];
    let index = -1;
    list.forEach((point, position) => {
      if (point.frame <= frame) index = position;
    });
    const point = list[index];
    if (point === undefined) return null;
    const before = list[index - 1];
    if (before === undefined || point.rampFrames <= 0 || frame >= point.frame + point.rampFrames) return point.value;
    const share = (frame - point.frame) / point.rampFrames;
    return before.value + (point.value - before.value) * share;
  }

  forget(belowGeneration: number): void {
    for (const key of this.#points.keys()) if (Number(key.split(":")[0]) < belowGeneration) this.#points.delete(key);
  }
}

export interface ToneSource {
  readonly manifest: InstrumentManifest;
  readonly track: ActivatedTrack;
  readonly generation: number;
  readonly trackIndex: number;
  readonly frame: number;
  readonly sampleRate: number;
  readonly points: ParameterPoints;
}

export function eventTone(source: ToneSource): EventTone {
  const { manifest, track } = source;
  const mapping = manifest.tone[0];
  const order = mapping === undefined ? -1 : manifest.parameters.findIndex((parameter) => parameter.name === mapping.parameter);
  const definition = manifest.parameters[order];
  if (mapping === undefined || definition === undefined) return { tone: 0.5, toneMotion: null };
  const index = INSTRUMENT_PARAMETER_OFFSET + order;
  const toPosition = (value: number): number => clamp01(curvePosition(definition.curve, mapping.from, mapping.to, value));
  const modulator = track.modulators.find((candidate) => candidate.index === index);
  if (modulator !== undefined && isAcceptedModulator(modulator)) {
    const value = modulatorValueAt(modulator, source.frame, source.frame, source.sampleRate);
    const toneMapping = { curve: definition.curve, from: mapping.from, to: mapping.to };
    const toneMotion: ToneMotion =
      modulator.kind === "lfo"
        ? { kind: "lfo", shape: modulator.shape, curve: modulator.curve, low: modulator.low, high: modulator.high, periodSeconds: modulator.periodFrames / source.sampleRate, phaseAtEvent: fraction((source.frame - modulator.originFrame) / modulator.periodFrames), mapping: toneMapping }
        : { kind: "envelope", curve: modulator.curve, low: modulator.low, high: modulator.high, seconds: modulator.seconds, mapping: toneMapping };
    return { tone: toPosition(value), toneMotion };
  }
  const pointValue = source.points.valueAt(source.generation, source.trackIndex, index, source.frame);
  const value = pointValue ?? track.parameters[index];
  return { tone: value === undefined || !Number.isFinite(value) ? 0.5 : toPosition(value), toneMotion: null };
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

function fraction(value: number): number {
  return value - Math.floor(value);
}
