// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { SyntaxNode } from "@lezer/common";
import { MAX_LOOP_BARS, MIN_LOOP_BARS } from "@untzel/core";
import { MAX_BARS_PER_PATTERN, MAX_STEPS_PER_BAR } from "../limits";
import type { LoopSyntax } from "../highlight/outline";
import { EditableSource } from "./document";
import { applyChanges, failure, type EditResult, type TextChange } from "./text-changes";

// Minimal edits for the lengths:
// how many bars the loop lasts, how many bars a pattern has and how many steps a bar
// has. Only the touched statement or pattern changes; comments and spacing stay.

const GLOBALS = new Set(["tempo", "key", "swing"]);
const BAR_SEPARATOR = " / ";
/** Hits characters per word when a hits-only bar is written again: "x... x... x... x...". */
const HITS_WORD = 4;

function isWhole(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Writes `loop <bars>`: replaces the number of an existing statement, or adds the line
 * after the last of tempo, key and swing (before everything else when there is none).
 */
export function setLoopBars(source: string, bars: number): EditResult {
  if (!isWhole(bars, MIN_LOOP_BARS, MAX_LOOP_BARS)) return failure("INVALID_VALUE");
  const document = new EditableSource(source);
  const { statements } = document;
  const loop = statements.find((statement): statement is LoopSyntax => statement.kind === "loop");
  if (loop !== undefined) {
    return applyChanges(source, [{ from: loop.value.from, to: loop.value.to, insert: String(bars) }]);
  }
  const line = `loop ${bars}`;
  const lastGlobal = statements.filter((statement) => GLOBALS.has(statement.kind)).at(-1);
  if (lastGlobal !== undefined) return applyChanges(source, [document.insertLineAfter(lastGlobal.line, line)]);
  const first = statements[0];
  if (first !== undefined) return applyChanges(source, [document.insertLineBefore(first.line, line)]);
  const separator = source === "" || source.endsWith("\n") ? "" : document.lineBreak;
  return applyChanges(source, [{ from: source.length, to: source.length, insert: `${separator}${line}` }]);
}

function patternBars(source: string, track: string): { readonly bars: readonly SyntaxNode[] } | "UNKNOWN_TRACK" | "UNKNOWN_STEP" {
  const found = new EditableSource(source).track(track);
  if (found === null) return "UNKNOWN_TRACK";
  const bars = found.syntax.pattern?.getChildren("Bar") ?? [];
  return bars.length === 0 ? "UNKNOWN_STEP" : { bars };
}

/**
 * Gives the pattern `bars` bars: new bars repeat the last one, so the track keeps
 * sounding the same until the person edits them; fewer bars drop the last ones.
 */
export function setTrackBars(source: string, track: string, bars: number): EditResult {
  if (!isWhole(bars, 1, MAX_BARS_PER_PATTERN)) return failure("INVALID_VALUE");
  const found = patternBars(source, track);
  if (typeof found === "string") return failure(found);
  const nodes = found.bars;
  const count = nodes.length;
  const last = nodes[count - 1];
  if (last === undefined || bars === count) return applyChanges(source, []);
  if (bars < count) {
    const keep = nodes[bars - 1];
    return keep === undefined ? failure("UNKNOWN_STEP") : applyChanges(source, [{ from: keep.to, to: last.to, insert: "" }]);
  }
  const previous = nodes[count - 2];
  const separator = previous === undefined ? BAR_SEPARATOR : source.slice(previous.to, last.from);
  const copy = `${separator}${source.slice(last.from, last.to)}`;
  return applyChanges(source, [{ from: last.to, to: last.to, insert: copy.repeat(bars - count) }]);
}

export type StepKind = "rest" | "sustain" | "sound";

/** One step of a bar as written: a hits character, or a whole element ("c2", "x?", "[x x]"). */
export interface StepToken {
  readonly text: string;
  readonly kind: StepKind;
}

function kindOfHit(char: string): StepKind {
  if (char === ".") return "rest";
  return char === "~" ? "sustain" : "sound";
}

/** The steps of a bar in the widths toggleStep uses; null when a hits word has a suffix. */
export function stepTokens(source: string, bar: SyntaxNode): StepToken[] | null {
  const tokens: StepToken[] = [];
  for (const element of bar.getChildren("Element")) {
    const atom = element.getChild("Atom")?.firstChild ?? null;
    if (atom === null) return null;
    const text = source.slice(element.from, element.to);
    const hasSuffix = element.to > atom.to;
    if (atom.name === "Hits" && atom.to - atom.from > 1) {
      if (hasSuffix) return null;
      for (const char of text) tokens.push({ text: char, kind: kindOfHit(char) });
      continue;
    }
    if (atom.name === "Sustain") tokens.push({ text, kind: "sustain" });
    else if (atom.name === "Hits" && !hasSuffix) tokens.push({ text, kind: kindOfHit(text) });
    else tokens.push({ text, kind: "sound" });
  }
  return tokens;
}

/**
 * More steps per bar keeps every step where it was in time: a sound or a held step is
 * followed by "~" when it holds (pitched tracks, or a hit already held by "~"), by "."
 * otherwise. Fewer steps keeps the steps that fall on the new grid.
 */
function resample(tokens: readonly StepToken[], count: number, hold: boolean): StepToken[] | null {
  const current = tokens.length;
  if (count === current) return [...tokens];
  if (count > current) {
    if (count % current !== 0) return null;
    const factor = count / current;
    return tokens.flatMap((token, index) => {
      const holds =
        token.kind === "sustain" || (token.kind === "sound" && (hold || tokens[index + 1]?.kind === "sustain"));
      const fill: StepToken = holds ? { text: "~", kind: "sustain" } : { text: ".", kind: "rest" };
      return [token, ...Array.from({ length: factor - 1 }, () => fill)];
    });
  }
  if (current % count !== 0) return null;
  const factor = current / count;
  return tokens.filter((_, index) => index % factor === 0);
}

/** Hits-only bars are written in words of four; anything else one element per step. */
export function printBar(tokens: readonly StepToken[]): string {
  const hitsOnly = tokens.every((token) => token.text.length === 1 && "xX.~".includes(token.text));
  if (!hitsOnly) return tokens.map((token) => token.text).join(" ");
  const words: string[] = [];
  for (let start = 0; start < tokens.length; start += HITS_WORD) {
    words.push(tokens.slice(start, start + HITS_WORD).map((token) => token.text).join(""));
  }
  return words.join(" ");
}

/**
 * Gives every bar of the pattern `count` steps (8, 16 or 32 from the track detail).
 * The new count must be a multiple or a divisor of each bar's count. `hold` is true for
 * pitched tracks, whose notes keep their length.
 */
export function setStepCount(source: string, track: string, count: number, hold: boolean): EditResult {
  if (!isWhole(count, 1, MAX_STEPS_PER_BAR)) return failure("INVALID_VALUE");
  const found = patternBars(source, track);
  if (typeof found === "string") return failure(found);
  const changes: TextChange[] = [];
  for (const bar of found.bars) {
    const tokens = stepTokens(source, bar);
    if (tokens === null || tokens.length === 0) return failure("INVALID_VALUE");
    if (tokens.length === count) continue;
    const next = resample(tokens, count, hold);
    if (next === null) return failure("INVALID_VALUE");
    changes.push({ from: bar.from, to: bar.to, insert: printBar(next) });
  }
  return applyChanges(source, changes);
}
