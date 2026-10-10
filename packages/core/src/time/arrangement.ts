// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Program, Section } from "../program/program";

/** Bars each section plays when the text has sections but no song. */
export const SECTION_ONLY_PART_BARS = 8;

export interface ArrangementPart {
  readonly section: Section;
  readonly bars: number;
  /** First bar of the part inside one pass of the arrangement. */
  readonly start: number;
}

export interface Arrangement {
  readonly parts: readonly ArrangementPart[];
  readonly totalBars: number;
  /** "song … | loop", or sections without song (they always cycle). */
  readonly loops: boolean;
  /** True when the text declares a song; false when it is synthesized from sections. */
  readonly declared: boolean;
}

export interface PartLocation {
  readonly partIndex: number;
  readonly part: ArrangementPart;
  readonly barInPart: number;
}

/** The song of the program, or one 8-bar part per section in order; null without sections. */
export function buildArrangement(program: Program): Arrangement | null {
  const sectionsByName = new Map(program.sections.map((section) => [section.name, section]));
  const declared = program.song !== null;
  const plan = declared
    ? (program.song?.parts ?? []).flatMap((part) => {
        const section = sectionsByName.get(part.section);
        return section === undefined ? [] : [{ section, bars: part.bars }];
      })
    : program.sections.map((section) => ({ section, bars: SECTION_ONLY_PART_BARS }));
  if (plan.length === 0) return null;

  let start = 0;
  const parts = plan.map(({ section, bars }) => {
    const part = { section, bars, start };
    start += bars;
    return part;
  });
  return { parts, totalBars: start, loops: !declared || (program.song?.loop ?? false), declared };
}

/**
 * Part at a bar counted from the start of the arrangement. Null before bar 0, or after
 * the end of an arrangement that does not loop.
 */
export function locate(arrangement: Arrangement, arrangementBar: number): PartLocation | null {
  if (arrangementBar < 0) return null;
  if (!arrangement.loops && arrangementBar >= arrangement.totalBars) return null;
  const inPass = arrangementBar % arrangement.totalBars;
  const partIndex = findPart(arrangement.parts, inPass);
  const part = arrangement.parts[partIndex];
  if (part === undefined) return null;
  return { partIndex, part, barInPart: inPass - part.start };
}

/** Binary search: last part whose start is not after the bar. */
function findPart(parts: readonly ArrangementPart[], inPass: number): number {
  let low = 0;
  let high = parts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if ((parts[middle]?.start ?? Infinity) <= inPass) low = middle;
    else high = middle - 1;
  }
  return low;
}
