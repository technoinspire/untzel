// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compilePattern } from "./compile-pattern";
import type { Event } from "./event";
import type { HitStep, PatternContext, PatternElement, PatternSpec } from "./pattern-spec";
import { probabilityDraw } from "./random";
import { add, compare, denominator, numerator, rational, toNumber, type Rational } from "../time/rational";

const context: PatternContext = {
  trackName: "t",
  sourceHash: 0x021f863b,
  key: { tonic: 0, scale: "minor" },
  free: false,
  transpose: 0,
  swing: rational(0n, 1n),
  shift: 0,
  velocity: 0.8,
  legato: false,
  voicing: null,
  inversion: 0,
  arp: null,
};

let offset = 0;
function at(length: number): { from: number; to: number } {
  const source = { from: offset, to: offset + length };
  offset += length + 1;
  return source;
}

const STEP: Readonly<Record<string, HitStep>> = { ".": "rest", x: "hit", X: "accent", "~": "sustain" };

function hits(text: string, extra: Partial<PatternElement> = {}): PatternElement {
  const steps = [...text].map((char) => STEP[char] ?? "rest");
  return { kind: "hits", steps, accent: false, probability: null, repeat: 1, source: at(text.length), ...extra } as PatternElement;
}

function note(midi: number, extra: Partial<PatternElement> = {}): PatternElement {
  return { kind: "note", midi, accent: false, probability: null, repeat: 1, source: at(2), ...extra } as PatternElement;
}

function chord(midis: readonly number[]): PatternElement {
  return { kind: "chord", midis, accent: false, probability: null, repeat: 1, source: at(3) };
}

function hold(): PatternElement {
  return { kind: "sustain", accent: false, probability: null, repeat: 1, source: at(1) };
}

function group(elements: readonly PatternElement[], extra: Partial<PatternElement> = {}): PatternElement {
  return { kind: "group", elements, accent: false, probability: null, repeat: 1, source: at(4), ...extra } as PatternElement;
}

function spec(...bars: (readonly PatternElement[])[]): PatternSpec {
  return { bars: bars.map((elements) => ({ elements, source: at(1) })) };
}

function r(n: number, d = 1): Rational {
  return rational(BigInt(n), BigInt(d));
}

function span(begin: Rational, end: Rational): { begin: Rational; end: Rational } {
  return { begin, end };
}

function onsets(events: readonly Event[]): number[] {
  return events.map((event) => toNumber(event.begin));
}

function key(event: Event): string {
  const begin = `${numerator(event.begin)}/${denominator(event.begin)}`;
  return `${begin}:${toNumber(event.duration)}:${JSON.stringify(event.value)}:${event.source.from}`;
}

describe("compilePattern layout", () => {
  it("splits a bar into equal steps", () => {
    const pattern = compilePattern(spec([hits("x..."), hits("x..."), hits("x..."), hits("X...")]), context);
    const events = pattern.query(span(r(0), r(1)));
    expect(onsets(events)).toEqual([0, 0.25, 0.5, 0.75]);
    expect(events.map((event) => event.velocity)).toEqual([0.8, 0.8, 0.8, 1]);
    expect(events[3]?.value).toEqual({ kind: "hit", accent: true });
    expect(events.every((event) => toNumber(event.duration) === 1 / 16)).toBe(true);
  });

  it("points each hit at its own character", () => {
    const element = hits("x.x.");
    const events = compilePattern(spec([element]), context).query(span(r(0), r(1)));
    expect(events.map((event) => event.source)).toEqual([
      { from: element.source.from, to: element.source.from + 1 },
      { from: element.source.from + 2, to: element.source.from + 3 },
    ]);
  });

  it("subdivides groups and repeats inside the same space", () => {
    const pattern = compilePattern(spec([hits("x"), group([hits("x"), hits("x")]), hits("x", { repeat: 4 }), hits("x")]), context);
    expect(onsets(pattern.query(span(r(0), r(1))))).toEqual([0, 0.25, 0.375, 0.5, 0.5625, 0.625, 0.6875, 0.75]);
  });

  it("extends the previous event with sustains inside the bar only", () => {
    const pattern = compilePattern(spec([hits("x~~~"), hold(), hold(), hits("."), hold()], [hits("~x")]), context);
    const events = pattern.query(span(r(0), r(2)));
    expect(events.map((event) => toNumber(event.duration))).toEqual([6 / 8, 1 / 2]);
    expect(onsets(events)).toEqual([0, 1.5]);
  });

  it("repeats an N-bar pattern with an N-bar cycle", () => {
    const pattern = compilePattern(spec([hits("x")], [hits(".x")]), context);
    expect(onsets(pattern.query(span(r(0), r(4))))).toEqual([0, 1.5, 2, 3.5]);
  });

  it("rotates by shift steps of the first bar", () => {
    const shifted = compilePattern(spec([hits("x...")]), { ...context, shift: 1 });
    expect(onsets(shifted.query(span(r(0), r(1))))).toEqual([0.25]);
    const back = compilePattern(spec([hits("x..."), hits("x...")]), { ...context, shift: -1 });
    expect(onsets(back.query(span(r(0), r(1))))).toEqual([0.375, 0.875]);
  });

  it("transposes and locks to the key, keeping the written note", () => {
    const pattern = compilePattern(spec([note(40), note(36)]), { ...context, transpose: 1 });
    const values = pattern.query(span(r(0), r(1))).map((event) => event.value);
    expect(values).toEqual([
      { kind: "note", midi: 41, writtenMidi: 40 },
      { kind: "note", midi: 36, writtenMidi: 36 },
    ]);
    const free = compilePattern(spec([note(40)]), { ...context, free: true });
    expect(free.query(span(r(0), r(1)))[0]?.value).toEqual({ kind: "note", midi: 40, writtenMidi: 40 });
  });

  it("locks every note of a chord", () => {
    const pattern = compilePattern(spec([chord([48, 52, 55])]), context);
    expect(pattern.query(span(r(0), r(1)))[0]?.value).toEqual({ kind: "chord", midis: [48, 51, 55] });
  });

  it("applies swing to onsets", () => {
    const pattern = compilePattern(spec([hits("xxxx....")]), { ...context, swing: r(1, 2) });
    expect(onsets(pattern.query(span(r(0), r(1))))).toEqual([0, 0.1875, 0.25, 0.4375]);
  });
});

describe("compilePattern probability", () => {
  it("draws per bar and element with the normative generator", () => {
    const pattern = compilePattern(
      spec([hits("x", { probability: 0.5 }), hits("x", { probability: 0.5 }), hits("x", { probability: 0.5 }), hits("x", { probability: 0.5 })]),
      { ...context, trackName: "h" },
    );
    for (let bar = 0; bar < 8; bar += 1) {
      const expected = [0, 1, 2, 3]
        .filter((element) => probabilityDraw(0x021f863b, "h", bar, element) < 0.5)
        .map((element) => bar + element / 4);
      expect(onsets(pattern.query(span(r(bar), r(bar + 1))))).toEqual(expected);
    }
  });

  it("draws once for a group, with the index of its first leaf", () => {
    const pattern = compilePattern(spec([hits("x."), group([hits("x"), hits("x")], { probability: 0.5 })]), { ...context, trackName: "h" });
    for (let bar = 0; bar < 16; bar += 1) {
      const plays = probabilityDraw(0x021f863b, "h", bar, 2) < 0.5;
      expect(pattern.query(span(r(bar), r(bar + 1)))).toHaveLength(plays ? 3 : 1);
    }
  });
});

describe("Pattern.query", () => {
  const leaf: fc.Arbitrary<PatternElement> = fc.oneof(
    fc.stringMatching(/^[xX.~]{1,6}$/).map((text) => hits(text)),
    fc.integer({ min: 24, max: 72 }).map((midi) => note(midi)),
    fc.constant(hold()),
  );
  const element = fc
    .tuple(
      fc.oneof(leaf, fc.array(leaf, { minLength: 1, maxLength: 3 }).map((elements) => group(elements))),
      fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: null }),
      fc.integer({ min: 1, max: 4 }),
    )
    .map(([base, probability, repeat]) => ({ ...base, probability, repeat }) as PatternElement);
  const patternSpec = fc
    .array(fc.array(element, { minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 3 })
    .map((bars) => spec(...bars));
  const patternContext = fc.record({
    shift: fc.integer({ min: -20, max: 20 }),
    swing: fc.integer({ min: 0, max: 50 }).map((value) => r(value, 100)),
    transpose: fc.integer({ min: -24, max: 24 }),
  });
  const cut = fc.tuple(fc.integer({ min: -48, max: 192 }), fc.integer({ min: 1, max: 24 })).map(([n, d]) => r(n, d));

  it("returns the union for adjacent spans, without duplicating or losing events", () => {
    fc.assert(
      fc.property(patternSpec, patternContext, cut, cut, cut, (pattern, overrides, a, b, c) => {
        const [first, middle, last] = [a, b, c].sort(compare);
        const compiled = compilePattern(pattern, { ...context, ...overrides });
        const whole = compiled.query(span(first as Rational, last as Rational)).map(key);
        const left = compiled.query(span(first as Rational, middle as Rational)).map(key);
        const right = compiled.query(span(middle as Rational, last as Rational)).map(key);
        expect([...left, ...right]).toEqual(whole);
      }),
      { numRuns: 300 },
    );
  });

  it("only returns events whose begin lies in the span, in order", () => {
    fc.assert(
      fc.property(patternSpec, patternContext, cut, cut, (pattern, overrides, a, b) => {
        const [begin, end] = [a, b].sort(compare) as [Rational, Rational];
        const events = compilePattern(pattern, { ...context, ...overrides }).query(span(begin, end));
        for (const event of events) {
          expect(compare(event.begin, begin)).toBeGreaterThanOrEqual(0);
          expect(compare(event.begin, end)).toBe(-1);
        }
        for (let index = 1; index < events.length; index += 1) {
          expect(compare((events[index - 1] as Event).begin, (events[index] as Event).begin)).toBeLessThanOrEqual(0);
        }
      }),
    );
  });

  it("is pure: the same span gives the same events", () => {
    const pattern = compilePattern(spec([hits("x?x?x?x?")]), context);
    const window = span(r(10_000), add(r(10_000), r(3)));
    expect(pattern.query(window).map(key)).toEqual(pattern.query(window).map(key));
  });

  it("returns nothing for an empty span or an empty spec", () => {
    expect(compilePattern(spec([hits("x")]), context).query(span(r(1), r(1)))).toEqual([]);
    expect(compilePattern({ bars: [] }, context).query(span(r(0), r(4)))).toEqual([]);
  });
});
