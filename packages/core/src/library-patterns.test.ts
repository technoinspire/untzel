// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arpNotes, invertChord, voiceChord } from "./pattern/arpeggio";
import { compilePattern } from "./pattern/compile-pattern";
import type { Event } from "./pattern/event";
import type { PatternContext, PatternElement, PatternSpec } from "./pattern/pattern-spec";
import { chordNameToMidis } from "./pitch/pitch";
import { add, compare, rational, toNumber, type Rational } from "./time/rational";

// Accents, stacks, voicings, the arpeggiator, legato and the cycle origin.

const CONTEXT: PatternContext = {
  trackName: "t",
  sourceHash: 0x1234,
  key: { tonic: 0, scale: "chromatic" },
  free: true,
  transpose: 0,
  swing: rational(0n, 1n),
  shift: 0,
  velocity: 0.8,
  legato: false,
  voicing: null,
  inversion: 0,
  arp: null,
};

const SOURCE = { from: 0, to: 1 };

function element(atom: Record<string, unknown>, accent = false): PatternElement {
  return { ...atom, accent, probability: null, repeat: 1, source: SOURCE } as PatternElement;
}

const note = (midi: number, accent = false) => element({ kind: "note", midi }, accent);
const rest = () => element({ kind: "hits", steps: ["rest"] });
const hold = () => element({ kind: "sustain" });
const stack = (midis: number[], accent = false) => element({ kind: "stack", midis }, accent);
const chord = (name: string, accent = false) => element({ kind: "chord", midis: chordNameToMidis(name) ?? [] }, accent);

function spec(...bars: PatternElement[][]): PatternSpec {
  return { bars: bars.map((elements) => ({ elements, source: SOURCE })) };
}

function bars(begin: number, end: number): { begin: Rational; end: Rational } {
  return { begin: rational(BigInt(begin), 1n), end: rational(BigInt(end), 1n) };
}

function query(pattern: PatternSpec, context: Partial<PatternContext> = {}, span = bars(0, 1)): readonly Event[] {
  return compilePattern(pattern, { ...CONTEXT, ...context }).query(span);
}

describe("accent and velocity", () => {
  it("plays x at the track velocity and accents at 1", () => {
    const hits = element({ kind: "hits", steps: ["hit", "rest", "hit", "hit"] }, true);
    const events = query(spec([hits]), { velocity: 0.6 });
    expect(events.map((event) => event.velocity)).toEqual([0.6, 0.6, 1]);
    const [, , last] = events;
    expect(last?.value).toEqual({ kind: "hit", accent: true });
  });

  it("accents a note, a stack, a chord and every leaf of a group", () => {
    const group = element({ kind: "group", elements: [note(60), note(64)] }, true);
    const events = query(spec([note(60, true), stack([60, 64], true), chord("Cm7", true), group]));
    expect(events.map((event) => event.velocity)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("stacks and voicings", () => {
  it("plays a stack as written, with no voicing", () => {
    const [event] = query(spec([stack([60, 63, 67])]), { voicing: "open" });
    expect(event?.value).toEqual({ kind: "chord", midis: [60, 63, 67] });
  });

  it("voices chord symbols: open, drop2, spread and inversion", () => {
    const cm7 = chordNameToMidis("Cm7") ?? [];
    expect(voiceChord(cm7, "close")).toEqual([48, 51, 55, 58]);
    expect(voiceChord(cm7, "open")).toEqual([48, 55, 58, 63]);
    expect(voiceChord(cm7, "drop2")).toEqual([43, 48, 51, 58]);
    expect(voiceChord(cm7, "spread")).toEqual([48, 55, 63, 70]);
    expect(invertChord(cm7, 1)).toEqual([51, 55, 58, 60]);
    const [event] = query(spec([chord("Cm7")]), { voicing: "open", inversion: 1 });
    expect(event?.value).toEqual({ kind: "chord", midis: [55, 58, 60, 63] });
  });
});

describe("the arpeggiator", () => {
  const arp = (mode: "up" | "down" | "updown" | "random" | "played", octaves = 1) => ({
    arp: { mode, rate: rational(1n, 16n), octaves },
  });
  const midis = (events: readonly Event[]) => events.map((event) => (event.value.kind === "note" ? event.value.midi : -1));

  it("walks a chord up, down, up and down, and as played", () => {
    const pattern = spec([stack([67, 60, 63])]);
    expect(midis(query(pattern, arp("up"))).slice(0, 4)).toEqual([60, 63, 67, 60]);
    expect(midis(query(pattern, arp("down"))).slice(0, 4)).toEqual([67, 63, 60, 67]);
    expect(midis(query(pattern, arp("updown"))).slice(0, 5)).toEqual([60, 63, 67, 63, 60]);
    expect(midis(query(pattern, arp("played"))).slice(0, 4)).toEqual([67, 60, 63, 67]);
    expect(arpNotes([60, 64], 2, "up")).toEqual([60, 64, 72, 76]);
  });

  it("splits a whole-bar chord into sixteenths that stay inside it", () => {
    const events = query(spec([chord("Cm")]), arp("up"));
    expect(events).toHaveLength(16);
    for (const event of events) expect(compare(add(event.begin, event.duration), rational(1n, 1n))).toBeLessThanOrEqual(0);
  });

  it("random: every note belongs to the chord, and the same text gives the same notes", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffff }), fc.integer({ min: 0, max: 40 }), (hash, bar) => {
        const context = { ...arp("random", 2), sourceHash: hash };
        const span = bars(bar, bar + 1);
        const first = midis(query(spec([chord("Cm7")]), context, span));
        const second = midis(query(spec([chord("Cm7")]), context, span));
        expect(first).toEqual(second);
        const allowed = new Set(arpNotes(chordNameToMidis("Cm7") ?? [], 2, "random"));
        for (const midi of first) expect(allowed.has(midi)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it("plays only the first note of a chord shorter than a step", () => {
    const short = element({ kind: "group", elements: Array.from({ length: 32 }, () => chord("Cm")) });
    const events = query(spec([short]), arp("up"));
    expect(events).toHaveLength(32);
    expect(new Set(midis(events))).toEqual(new Set([48]));
  });
});

describe("legato", () => {
  it("holds each note until the next written note, the last one wrapping to the first", () => {
    const pattern = spec([note(60), rest(), note(62), rest()], [note(64), hold(), rest(), rest()]);
    const events = query(pattern, { legato: true }, bars(0, 2));
    expect(events.map((event) => toNumber(event.duration))).toEqual([0.5, 0.5, 1]);
  });

  it("crosses the bar line, and a note left out by ? does not shorten the previous one", () => {
    const maybe = { ...note(62), probability: 0 } as PatternElement;
    const pattern = spec([note(60), rest(), rest(), maybe]);
    const events = query(pattern, { legato: true }, bars(0, 1));
    expect(events).toHaveLength(1);
    expect(toNumber(events[0]?.duration ?? rational(0n, 1n))).toBe(0.75);
  });
});

describe("cycle origin", () => {
  it("starts an 8-bar cycle at the given bar", () => {
    const eight = spec([note(60)], [rest()], [rest()], [rest()], [rest()], [rest()], [rest()], [rest()]);
    const pattern = compilePattern(eight, CONTEXT);
    expect(pattern.query(bars(4, 5))).toHaveLength(0);
    const fromSix = pattern.query(bars(6, 7), rational(6n, 1n));
    expect(fromSix).toHaveLength(1);
    expect(toNumber(fromSix[0]?.begin ?? rational(0n, 1n))).toBe(6);
  });
});
