// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { SECTION_ONLY_PART_BARS, buildArrangement, locate } from "./arrangement";
import type { Program, Section } from "../program/program";
import { rational } from "./rational";
import { curvePosition, interp } from "../pattern/signal";
import { createOrigin, frameAt } from "./tempo-origin";
import { originAtBar } from "./timeline";

const SR = 48_000;
const bpm = (value: number) => rational(BigInt(value), 1n);
const bar = (value: number) => rational(BigInt(value), 1n);

function section(name: string, tempo: number | null, isLoop = false): Section {
  return { name, tracks: [], tempo: tempo === null ? null : bpm(tempo), gain: 1, isLoop };
}

function program(options: Partial<Program>): Program {
  return {
    title: null,
    tempo: bpm(132),
    key: { tonic: 0, scale: "minor" },
    swing: rational(0n, 1n),
    tracks: [],
    sections: [],
    song: null,
    loopBars: null,
    sourceHash: 1,
    lightSourceHash: 1,
    stagePlanHash: 1,
    seedDependent: false,
    ...options,
  };
}

const twoTempos = program({
  sections: [section("intro", 120), section("drop", null)],
  song: {
    parts: [
      { section: "intro", bars: 4 },
      { section: "drop", bars: 8 },
      { section: "intro", bars: 2 },
    ],
    loop: true,
  },
});

describe("arrangement", () => {
  it("builds the declared song with part starts", () => {
    const arrangement = buildArrangement(twoTempos);
    expect(arrangement?.parts.map((part) => [part.section.name, part.start, part.bars])).toEqual([
      ["intro", 0, 4],
      ["drop", 4, 8],
      ["intro", 12, 2],
    ]);
    expect(arrangement).toMatchObject({ totalBars: 14, loops: true, declared: true });
  });

  it("plays each section for 8 bars when there is no song, and always cycles", () => {
    const arrangement = buildArrangement(program({ sections: [section("a", null), section("b", null)] }));
    expect(arrangement).toMatchObject({ totalBars: 2 * SECTION_ONLY_PART_BARS, loops: true, declared: false });
  });

  it("locates parts, wraps a looping song and ends one that does not loop", () => {
    const arrangement = buildArrangement(twoTempos);
    if (arrangement === null) throw new Error("no arrangement");
    expect(locate(arrangement, 5)).toMatchObject({ partIndex: 1, barInPart: 1 });
    expect(locate(arrangement, 14 + 13)).toMatchObject({ partIndex: 2, barInPart: 1 });
    expect(locate(arrangement, -1)).toBeNull();
    const once = buildArrangement(program({ ...twoTempos, song: { parts: twoTempos.song?.parts ?? [], loop: false } }));
    if (once === null) throw new Error("no arrangement");
    expect(locate(once, 13)).toMatchObject({ partIndex: 2 });
    expect(locate(once, 14)).toBeNull();
  });

  it("is null without sections", () => {
    expect(buildArrangement(program({}))).toBeNull();
  });
});

describe("originAtBar", () => {
  it("at bar 0 is the origin a play creates, in both modes", () => {
    const arrangement = buildArrangement(twoTempos);
    expect(originAtBar(twoTempos, arrangement, "song", 0, SR)).toEqual(createOrigin(bar(0), 0, bpm(120), SR));
    expect(originAtBar(twoTempos, arrangement, "loop", 0, SR)).toEqual(createOrigin(bar(0), 0, bpm(132), SR));
  });

  it("chains the retempo of every part start, across passes", () => {
    const arrangement = buildArrangement(twoTempos);
    const at120 = (240 * SR) / 120;
    const at132 = (240 * SR) / 132;
    const bar4 = 4 * at120;
    const bar12 = bar4 + Math.floor(8 * at132);
    const bar14 = bar12 + 2 * at120;
    const bar18 = bar14 + 4 * at120;
    const origin = originAtBar(twoTempos, arrangement, "song", 20, SR);
    expect(origin.tempo).toEqual(bpm(132));
    expect(frameAt(origin, bar(18))).toBe(bar18);
    expect(frameAt(origin, bar(20))).toBe(bar18 + Math.floor(2 * at132));
    expect(frameAt(originAtBar(twoTempos, arrangement, "song", 13, SR), bar(12))).toBe(bar12);
    expect(originAtBar(twoTempos, arrangement, "song", 13, SR).tempo).toEqual(bpm(120));
  });

  it("does not reanchor where the tempo stays the same, like the transport's #enterBar", () => {
    // 132 → 132 → 120: a reanchor at bar 1 would floor twice and lose a frame at bar 2.
    const sameTempo = program({
      sections: [section("a", null), section("b", 132), section("c", 120)],
      song: {
        parts: [
          { section: "a", bars: 1 },
          { section: "b", bars: 1 },
          { section: "c", bars: 2 },
        ],
        loop: true,
      },
    });
    const arrangement = buildArrangement(sameTempo);
    const at132 = (240 * SR) / 132;
    const origin = originAtBar(sameTempo, arrangement, "song", 2, SR);
    expect(origin.tempo).toEqual(bpm(120));
    expect(frameAt(origin, bar(2))).toBe(Math.floor(2 * at132));
    expect(Math.floor(2 * at132)).not.toBe(2 * Math.floor(at132));
    expect(frameAt(originAtBar(sameTempo, arrangement, "song", 1, SR), bar(1))).toBe(Math.floor(at132));
  });

  it("ignores sections in loop mode", () => {
    const arrangement = buildArrangement(twoTempos);
    const origin = originAtBar(twoTempos, arrangement, "loop", 21, SR);
    expect(origin).toEqual(createOrigin(bar(0), 0, bpm(132), SR));
  });
  it("plays loop mode at the loop section's tempo", () => {
    const looped = program({ ...twoTempos, sections: [section("intro", 120, true), section("drop", null)] });
    expect(originAtBar(looped, buildArrangement(looped), "loop", 5, SR)).toEqual(createOrigin(bar(0), 0, bpm(120), SR));
    const tempoless = program({ ...twoTempos, sections: [section("intro", 120), section("drop", null, true)] });
    expect(originAtBar(tempoless, buildArrangement(tempoless), "loop", 5, SR).tempo).toEqual(bpm(132));
  });
});

describe("curvePosition", () => {
  it("inverts interp on both curves and clamps", () => {
    for (const x of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
      expect(curvePosition("linear", -12, 12, interp("linear", -12, 12, x))).toBeCloseTo(x, 12);
      expect(curvePosition("exponential", 40, 8000, interp("exponential", 40, 8000, x))).toBeCloseTo(x, 12);
    }
    expect(curvePosition("linear", 0, 1, 2)).toBe(1);
    expect(curvePosition("exponential", 40, 8000, 1)).toBe(0);
    expect(curvePosition("linear", 1, 1, 1)).toBe(0);
  });
});
