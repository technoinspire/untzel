// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { TextRange } from "@untzel/editor";

// Just enough reading of the source for the fake: where each track's steps are, and
// which section names point at missing tracks. The real session gets both from
// @untzel/language.

export interface IndexedStep {
  readonly range: TextRange;
  readonly isRest: boolean;
}

export interface IndexedTrack {
  readonly name: string;
  readonly line: number;
  readonly steps: readonly IndexedStep[];
}

const TRACK_LINE = /^([a-z][a-z0-9_-]*):(\s+)([a-z][a-z0-9_-]*)(\s+)([^|]*)/;

export function indexTracks(source: string): readonly IndexedTrack[] {
  const tracks: IndexedTrack[] = [];
  let offset = 0;
  source.split("\n").forEach((text, index) => {
    const match = TRACK_LINE.exec(text);
    if (match !== null) {
      const [, name = "", gapA = "", instrument = "", gapB = "", pattern = ""] = match;
      const start = offset + name.length + 1 + gapA.length + instrument.length + gapB.length;
      tracks.push({ name, line: index + 1, steps: stepsIn(pattern, start) });
    }
    offset += text.length + 1;
  });
  return tracks;
}

function stepsIn(pattern: string, start: number): IndexedStep[] {
  const steps: IndexedStep[] = [];
  const bar = pattern.split("/")[0] ?? "";
  for (const token of bar.matchAll(/\S+/g)) {
    const from = start + (token.index ?? 0);
    const text = token[0];
    if (/^[xX.~]+$/.test(text) && text.length > 1) {
      [...text].forEach((char, index) => steps.push({ range: { from: from + index, to: from + index + 1 }, isRest: char === "." || char === "~" }));
    } else {
      steps.push({ range: { from, to: from + text.length }, isRest: text === "." || text === "~" });
    }
  }
  return steps;
}

export interface FakeDiagnostic {
  readonly from: number;
  readonly to: number;
  readonly message: string;
  readonly section: string;
  readonly track: string;
}

/** Section members that name no track, as language reports UNKNOWN_TRACK. */
export function unknownMembers(source: string): readonly FakeDiagnostic[] {
  const names = new Set(indexTracks(source).map((track) => track.name));
  const found: FakeDiagnostic[] = [];
  let offset = 0;
  for (const text of source.split("\n")) {
    const section = /^section\s+([a-z][a-z0-9_-]*)/.exec(text);
    if (section !== null) {
      for (const word of text.slice(section[0].length).matchAll(/[a-z][a-z0-9_-]*/g)) {
        if (names.has(word[0])) continue;
        const from = offset + section[0].length + (word.index ?? 0);
        found.push({ from, to: from + word[0].length, message: `Section "${section[1]}" uses "${word[0]}", but no track has that name.`, section: section[1] ?? "", track: word[0] });
      }
    }
    offset += text.length + 1;
  }
  return found;
}
