// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  compare,
  type Key,
  type ModulatorSpec,
  type Program,
  type Rational,
  type ResolvedParameter,
  type Section,
  type Song,
  type Track,
} from "@untzel/core";

/**
 * "parameters": only constant parameter values changed, so the change can sound now.
 * "structural": anything else, which waits for the next unscheduled bar boundary.
 */
export type ChangeClass = "parameters" | "structural";

/** A constant parameter whose value differs between the active and the next program. */
export interface ParameterChange {
  readonly trackIndex: number;
  readonly parameter: number;
  readonly value: number;
}

/** How a program swap applies: parameter-only changes sound now, the rest waits for a bar. */
export function classifyChange(active: Program, next: Program): ChangeClass {
  const same =
    compare(active.tempo, next.tempo) === 0 &&
    compare(active.swing, next.swing) === 0 &&
    active.loopBars === next.loopBars &&
    sameKey(active.key, next.key) &&
    sameList(active.sections, next.sections, sameSection) &&
    sameSong(active.song, next.song) &&
    sameList(active.tracks, next.tracks, sameTrackStructure);
  return same ? "parameters" : "structural";
}

/** Constant parameters that changed. Only meaningful when classifyChange is "parameters". */
export function changedParameters(active: Program, next: Program): readonly ParameterChange[] {
  const changes: ParameterChange[] = [];
  next.tracks.forEach((track, trackIndex) => {
    const before = active.tracks[trackIndex];
    if (before === undefined) return;
    for (const parameter of track.parameters) {
      const previous = before.parameters.find((candidate) => candidate.index === parameter.index);
      if (parameter.value.kind !== "constant" || previous?.value.kind !== "constant") continue;
      if (previous.value.value === parameter.value.value) continue;
      changes.push({ trackIndex, parameter: parameter.index, value: parameter.value.value });
    }
  });
  return changes;
}

function sameTrackStructure(a: Track, b: Track): boolean {
  return (
    a.name === b.name &&
    a.instrument === b.instrument &&
    a.muted === b.muted &&
    a.free === b.free &&
    a.transpose === b.transpose &&
    a.shift === b.shift &&
    sameOptionalRational(a.swing, b.swing) &&
    sameIgnoringSource(a.pattern, b.pattern) &&
    sameList(a.parameters, b.parameters, sameParameterStructure) &&
    a.velocity === b.velocity &&
    a.legato === b.legato &&
    a.voicing === b.voicing &&
    a.inversion === b.inversion &&
    sameArp(a, b) &&
    sameList(a.effects, b.effects, (x, y) => x === y) &&
    sameList(a.modulators, b.modulators, sameModulator)
  );
}

function sameArp(a: Track, b: Track): boolean {
  if (a.arp === null || b.arp === null) return a.arp === b.arp;
  return a.arp.mode === b.arp.mode && a.arp.octaves === b.arp.octaves && compare(a.arp.rate, b.arp.rate) === 0;
}

/** A fast signal or envelope changes the DSP setup: any difference is structural. */
function sameModulator(a: ModulatorSpec, b: ModulatorSpec): boolean {
  if (a.kind !== b.kind || a.index !== b.index || a.from !== b.from || a.to !== b.to || a.curve !== b.curve) {
    return false;
  }
  if (a.kind === "lfo" && b.kind === "lfo") return a.shape === b.shape && compare(a.periodBars, b.periodBars) === 0;
  return a.kind === "envelope" && b.kind === "envelope" && a.seconds === b.seconds;
}

/** Constants may differ in value; a signal must be identical (a new signal is structural). */
function sameParameterStructure(a: ResolvedParameter, b: ResolvedParameter): boolean {
  if (a.index !== b.index) return false;
  if (a.value.kind === "constant" || b.value.kind === "constant") {
    return a.value.kind === b.value.kind;
  }
  return (
    a.value.signal.shape === b.value.signal.shape &&
    compare(a.value.signal.periodBars, b.value.signal.periodBars) === 0 &&
    a.value.low === b.value.low &&
    a.value.high === b.value.high &&
    a.value.from === b.value.from &&
    a.value.to === b.value.to &&
    a.value.curve === b.value.curve
  );
}

function sameSection(a: Section, b: Section): boolean {
  return (
    a.name === b.name &&
    a.gain === b.gain &&
    a.isLoop === b.isLoop &&
    sameOptionalRational(a.tempo, b.tempo) &&
    sameList(a.tracks, b.tracks, (x, y) => x === y)
  );
}

function sameSong(a: Song | null, b: Song | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.loop === b.loop &&
    sameList(a.parts, b.parts, (x, y) => x.section === y.section && x.bars === y.bars)
  );
}

function sameKey(a: Key, b: Key): boolean {
  return a.tonic === b.tonic && a.scale === b.scale;
}

function sameOptionalRational(a: Rational | null, b: Rational | null): boolean {
  if (a === null || b === null) return a === b;
  return compare(a, b) === 0;
}

function sameList<T>(a: readonly T[], b: readonly T[], same: (x: T, y: T) => boolean): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return other !== undefined && same(item, other);
  });
}

/**
 * Deep equality of plain pattern data, skipping every "source" range: an edit earlier
 * in the text shifts offsets without changing what plays. PatternSpec holds only
 * numbers, strings and arrays, never a Rational.
 */
function sameIgnoringSource(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a).filter((key) => key !== "source");
  const keysB = Object.keys(b).filter((key) => key !== "source");
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    sameIgnoringSource((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
