// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Over 300 lines: the pattern compiler; the layout of one cycle and CompiledPattern's query share one event model, and query runs on the scheduling path.

import { arpNotes, arpStepNote, invertChord, randomArpNote, voiceChord } from "./arpeggio";
import type { Event, EventValue, Pattern, SourceRange } from "./event";
import type { PatternAtom, PatternContext, PatternElement, PatternSpec } from "./pattern-spec";
import { quantizeToScale } from "../pitch/pitch";
import { probabilityDraw } from "./random";
import {
  add,
  compare,
  div,
  floor,
  mul,
  rational,
  sub,
  type Rational,
} from "../time/rational";
import { applySwing } from "../time/swing";
import type { TimeSpan } from "../time/time-span";

/** One "?" an event depends on: the element's first leaf and its probability. */
interface Draw {
  readonly elementIndex: number;
  readonly probability: number;
}

/** A step of a `random` arpeggio: the note is drawn at query time (it needs the bar). */
interface RandomArpStep {
  readonly notes: readonly number[];
  readonly step: number;
}

/** An event of one cycle, relative to the cycle start. */
interface CycleEvent {
  readonly begin: Rational;
  readonly duration: Rational;
  readonly value: EventValue;
  readonly velocity: number;
  readonly source: SourceRange;
  readonly draws: readonly Draw[];
  readonly randomArp: RandomArpStep | null;
}

/** Layout state of one bar. `duration` stays mutable until "~" stops extending it. */
interface DraftEvent extends Omit<CycleEvent, "duration" | "randomArp"> {
  duration: Rational;
  /** Played midis of a chord or stack in written order (the `played` arpeggio). */
  readonly played: readonly number[] | null;
}

interface BarLayout {
  readonly events: DraftEvent[];
  /** The event a "~" extends; null after a rest or at the start of the bar. */
  last: DraftEvent | null;
  /** Pre-order leaf counter: the elementIndex of the next leaf. */
  leaf: number;
}

const ACCENT_VELOCITY = 1;
const MIDI_MAX = 127;
const ONE = rational(1n, 1n);

function whole(value: number | bigint): Rational {
  return rational(BigInt(value), 1n);
}

/** Steps an element occupies in its parent: one per hits character, one otherwise. */
function weight(element: PatternElement): number {
  return element.kind === "hits" ? element.steps.length : 1;
}

function barSteps(elements: readonly PatternElement[]): number {
  return elements.reduce((total, element) => total + weight(element), 0);
}

function clampMidi(midi: number): number {
  return Math.min(MIDI_MAX, Math.max(0, midi));
}

function playedMidi(written: number, context: PatternContext): number {
  const { free, key, transpose } = context;
  const moved = written + transpose;
  return clampMidi(free ? moved : quantizeToScale(moved, key));
}

/** Played notes in written order, repeats after the key lock dropped. */
function playedInOrder(written: readonly number[], context: PatternContext): readonly number[] {
  return [...new Set(written.map((midi) => playedMidi(midi, context)))];
}

function chordMidis(played: readonly number[]): readonly number[] {
  return [...played].sort((a, b) => a - b);
}

function velocityOf(accent: boolean, context: PatternContext): number {
  return accent ? ACCENT_VELOCITY : context.velocity;
}

function push(layout: BarLayout, event: DraftEvent): void {
  layout.events.push(event);
  layout.last = event;
}

function sustain(layout: BarLayout, length: Rational): void {
  if (layout.last !== null) layout.last.duration = add(layout.last.duration, length);
}

function layoutHits(
  atom: Extract<PatternElement, { kind: "hits" }>,
  start: Rational,
  length: Rational,
  draws: readonly Draw[],
  accented: boolean,
  layout: BarLayout,
  context: PatternContext,
): void {
  const { source } = atom;
  const step = div(length, whole(atom.steps.length));
  const last = atom.steps.length - 1;
  atom.steps.forEach((kind, index) => {
    const begin = add(start, mul(step, whole(index)));
    const stepSource = { from: source.from + index, to: source.from + index + 1 };
    if (kind === "rest") layout.last = null;
    if (kind === "sustain") sustain(layout, step);
    if (kind === "hit" || kind === "accent") {
      // "!" after a hits token accents its last step only; a group accent every hit.
      const accent = kind === "accent" || (atom.accent && index === last) || accented;
      const value = { kind: "hit", accent } as const;
      push(layout, { begin, duration: step, value, velocity: velocityOf(accent, context), source: stepSource, draws, played: null });
    }
    layout.leaf += 1;
  });
}

/** Chord symbol → voicing → inversion (written pitches); a stack is taken as written. */
function writtenChord(element: Extract<PatternElement, { kind: "chord" | "stack" }>, context: PatternContext): readonly number[] {
  if (element.kind === "stack") return element.midis;
  return invertChord(voiceChord(element.midis, context.voicing), context.inversion);
}

function layoutAtom(
  element: PatternElement,
  start: Rational,
  length: Rational,
  draws: readonly Draw[],
  accented: boolean,
  layout: BarLayout,
  context: PatternContext,
): void {
  const accent = accented || element.accent;
  switch (element.kind) {
    case "hits":
      layoutHits(element, start, length, draws, accented, layout, context);
      return;
    case "note": {
      const value = { kind: "note", midi: playedMidi(element.midi, context), writtenMidi: element.midi } as const;
      push(layout, { begin: start, duration: length, value, velocity: velocityOf(accent, context), source: element.source, draws, played: null });
      layout.leaf += 1;
      return;
    }
    case "chord":
    case "stack": {
      const played = playedInOrder(writtenChord(element, context), context);
      const value = { kind: "chord", midis: chordMidis(played) } as const;
      push(layout, { begin: start, duration: length, value, velocity: velocityOf(accent, context), source: element.source, draws, played });
      layout.leaf += 1;
      return;
    }
    case "sustain":
      sustain(layout, length);
      layout.leaf += 1;
      return;
    case "group":
      layoutSequence(element.elements, start, length, draws, accent, layout, context);
  }
}

function layoutElement(
  element: PatternElement,
  start: Rational,
  length: Rational,
  draws: readonly Draw[],
  accented: boolean,
  layout: BarLayout,
  context: PatternContext,
): void {
  const copyLength = div(length, whole(element.repeat));
  for (let copy = 0; copy < element.repeat; copy += 1) {
    const copyDraws =
      element.probability === null
        ? draws
        : [...draws, { elementIndex: layout.leaf, probability: element.probability }];
    layoutAtom(element, add(start, mul(copyLength, whole(copy))), copyLength, copyDraws, accented, layout, context);
  }
}

function layoutSequence(
  elements: readonly PatternElement[],
  start: Rational,
  length: Rational,
  draws: readonly Draw[],
  accented: boolean,
  layout: BarLayout,
  context: PatternContext,
): void {
  const unit = div(length, whole(barSteps(elements)));
  let cursor = start;
  for (const element of elements) {
    const elementLength = mul(unit, whole(weight(element)));
    layoutElement(element, cursor, elementLength, draws, accented, layout, context);
    cursor = add(cursor, elementLength);
  }
}

function modulo(value: Rational, cycle: Rational): Rational {
  return sub(value, mul(whole(floor(div(value, cycle))), cycle));
}

/** Splits every chord or stack into arpeggio steps inside its duration. */
function arpeggiate(events: readonly DraftEvent[], context: PatternContext): CycleEvent[] {
  const arp = context.arp;
  return events.flatMap((event): CycleEvent[] => {
    if (arp === null || event.value.kind !== "chord" || event.played === null) {
      return [{ ...event, randomArp: null }];
    }
    const notes = arpNotes(event.played, arp.octaves, arp.mode);
    const steps = Math.max(1, Number(floor(div(event.duration, arp.rate))));
    const out: CycleEvent[] = [];
    for (let step = 0; step < steps; step += 1) {
      const begin = add(event.begin, mul(arp.rate, whole(step)));
      const duration = steps === 1 ? event.duration : arp.rate;
      const midi = arpStepNote(notes, step);
      const randomArp = arp.mode === "random" ? { notes, step } : null;
      const value = { kind: "note", midi, writtenMidi: midi } as const;
      out.push({ begin, duration, value, velocity: event.velocity, source: event.source, draws: event.draws, randomArp });
    }
    return out;
  });
}

/** Each note lasts until the next written note of the cycle (the last wraps). */
function applyLegato(events: CycleEvent[], cycle: Rational): CycleEvent[] {
  if (events.length === 0) return events;
  return events.map((event, index) => {
    const next = events[index + 1];
    const end = next === undefined ? add(events[0]?.begin ?? event.begin, cycle) : next.begin;
    const duration = compare(end, event.begin) > 0 ? sub(end, event.begin) : cycle;
    return { ...event, duration };
  });
}

/** Every event of one cycle, shifted, swung and sorted by begin. */
function layoutCycle(spec: PatternSpec, context: PatternContext): readonly CycleEvent[] {
  const cycle = whole(spec.bars.length);
  const firstBarSteps = barSteps(spec.bars[0]?.elements ?? []);
  const offset = div(whole(context.shift), whole(firstBarSteps));
  const drafts = spec.bars.flatMap((bar, index) => {
    const layout: BarLayout = { events: [], last: null, leaf: 0 };
    layoutSequence(bar.elements, whole(index), ONE, [], false, layout, context);
    return layout.events;
  });
  const events = arpeggiate(drafts, context)
    .map((event) => ({
      ...event,
      begin: applySwing(modulo(add(event.begin, offset), cycle), context.swing),
    }))
    .sort((a, b) => compare(a.begin, b.begin));
  return context.legato ? applyLegato(events, cycle) : events;
}

/** Index of the first event whose begin is not below `bound`. */
function lowerBound(events: readonly CycleEvent[], bound: Rational): number {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const event = events[middle];
    if (event !== undefined && compare(event.begin, bound) < 0) low = middle + 1;
    else high = middle;
  }
  return low;
}

const ZERO = rational(0n, 1n);

class CompiledPattern implements Pattern {
  readonly #events: readonly CycleEvent[];
  readonly #cycle: Rational;
  readonly #context: PatternContext;

  constructor(events: readonly CycleEvent[], cycleBars: number, context: PatternContext) {
    this.#events = events;
    this.#cycle = whole(cycleBars);
    this.#context = context;
  }

  /**
   * `cycleOrigin`: the bar where the cycle starts (the start of the current part in
   * song mode); 0 by default. Draws of "?" keep the absolute bar.
   */
  query(span: TimeSpan, cycleOrigin: Rational = ZERO): readonly Event[] {
    if (this.#events.length === 0 || compare(span.begin, span.end) >= 0) return [];
    const found: Event[] = [];
    const begin = sub(span.begin, cycleOrigin);
    const end = sub(span.end, cycleOrigin);
    for (let cycle = floor(div(begin, this.#cycle)); ; cycle += 1n) {
      const cycleStart = mul(whole(cycle), this.#cycle);
      if (compare(cycleStart, end) >= 0) break;
      this.#collect(cycleStart, begin, end, cycleOrigin, found);
    }
    return found;
  }

  #collect(cycleStart: Rational, spanBegin: Rational, spanEnd: Rational, origin: Rational, found: Event[]): void {
    const low = sub(spanBegin, cycleStart);
    const high = sub(spanEnd, cycleStart);
    for (let index = lowerBound(this.#events, low); index < this.#events.length; index += 1) {
      const event = this.#events[index];
      if (event === undefined || compare(event.begin, high) >= 0) return;
      const begin = add(add(cycleStart, event.begin), origin);
      const barIndex = Number(floor(begin));
      if (this.#plays(event, barIndex)) {
        const { duration, velocity, source } = event;
        const value = this.#valueOf(event, barIndex);
        found.push({ track: this.#context.trackName, begin, duration, value, velocity, source });
      }
    }
  }

  #valueOf(event: CycleEvent, barIndex: number): EventValue {
    const arp = event.randomArp;
    if (arp === null) return event.value;
    const { sourceHash, trackName } = this.#context;
    const midi = randomArpNote(arp.notes, sourceHash, trackName, barIndex, arp.step);
    return { kind: "note", midi, writtenMidi: midi };
  }

  #plays(event: CycleEvent, barIndex: number): boolean {
    const { sourceHash, trackName } = this.#context;
    return event.draws.every(
      (draw) => probabilityDraw(sourceHash, trackName, barIndex, draw.elementIndex) < draw.probability,
    );
  }
}

/** Builds the pure query function of one track. */
export function compilePattern(spec: PatternSpec, context: PatternContext): Pattern {
  if (spec.bars.length === 0 || barSteps(spec.bars[0]?.elements ?? []) === 0) {
    return new CompiledPattern([], 1, context);
  }
  return new CompiledPattern(layoutCycle(spec, context), spec.bars.length, context);
}
