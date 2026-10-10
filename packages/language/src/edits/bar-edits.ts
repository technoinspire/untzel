// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { SyntaxNode } from "@lezer/common";
import { parser } from "../read/parser";
import { EditableSource } from "./document";
import { printBar, stepTokens } from "./length-edits";
import { applyChanges, failure, type EditResult } from "./text-changes";

// Copy bar, Paste here and Clear bar of the track detail.
// A bar is the text between two "/" of a pattern; only that text
// changes, so comments, modifiers and the other bars stay as written.

/** A probe line that reads `text` as the pattern of a track, to check it is one bar. */
const PROBE_PREFIX = "probe: kick ";
const REST = ".";

function barNode(source: string, track: string, bar: number): SyntaxNode | "UNKNOWN_TRACK" | "UNKNOWN_STEP" {
  const found = new EditableSource(source).track(track);
  if (found === null) return "UNKNOWN_TRACK";
  return found.syntax.pattern?.getChildren("Bar")[bar] ?? "UNKNOWN_STEP";
}

/** The elements of one bar as written ("x... x.x. x... x..."); null when there is none. */
export function readBar(source: string, track: string, bar: number): string | null {
  const node = barNode(source, track, bar);
  return typeof node === "string" ? null : source.slice(node.from, node.to);
}

/** True when `text` reads as exactly one bar of steps, with nothing else around it. */
function isOneBar(text: string): boolean {
  if (text.trim() === "" || /[\r\n|/]/.test(text)) return false;
  const tree = parser.parse(`${PROBE_PREFIX}${text}`);
  let hasError = false;
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) hasError = true;
    },
  });
  if (hasError) return false;
  const pattern = tree.topNode.getChild("Line")?.getChild("Track")?.getChild("Pattern") ?? null;
  return pattern !== null && pattern.getChildren("Bar").length === 1;
}

/**
 * Paste here: the bar takes `text`, the elements of the copied bar as readBar gave them.
 * Fails on anything that is not one bar, so a paste can never break the line.
 */
export function replaceBar(source: string, track: string, bar: number, text: string): EditResult {
  const elements = text.trim();
  if (!isOneBar(elements)) return failure("INVALID_VALUE");
  const node = barNode(source, track, bar);
  if (typeof node === "string") return failure(node);
  if (source.slice(node.from, node.to) === elements) return applyChanges(source, []);
  return applyChanges(source, [{ from: node.from, to: node.to, insert: elements }]);
}

/**
 * Clear bar: the same number of steps, all rests. Drum bars are written in words of
 * four ("...."); `separate` (pitched tracks) writes one "." per step, so a tap on a step
 * then puts a note there, as toggleStep does with a lone rest.
 */
export function clearBar(source: string, track: string, bar: number, separate: boolean): EditResult {
  const node = barNode(source, track, bar);
  if (typeof node === "string") return failure(node);
  const tokens = stepTokens(source, node);
  if (tokens === null || tokens.length === 0) return failure("INVALID_VALUE");
  const rests = tokens.map(() => ({ text: REST, kind: "rest" as const }));
  const insert = separate ? rests.map((token) => token.text).join(" ") : printBar(rests);
  if (source.slice(node.from, node.to) === insert) return applyChanges(source, []);
  return applyChanges(source, [{ from: node.from, to: node.to, insert }]);
}
