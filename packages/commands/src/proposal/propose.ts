// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { AnalyzeResult, Diagnostic } from "@untzel/language";
import { changedLineCount, lineDiff } from "./diff";
import { error, info, type CommandOutcome } from "./outcome";
import { strings } from "../copy/copy";

// The one path every text-changing command ends in. A future assistant proposes through
// the same function.

export interface ProposeOptions {
  readonly title: string;
  readonly summary: string;
  /** Removes or overwrites something the person wrote: always previewed. */
  readonly destructive: boolean;
}

function errorKeys(result: AnalyzeResult): Map<string, number> {
  const counts = new Map<string, number>();
  if (result.ok) return counts;
  for (const diagnostic of result.diagnostics) {
    const key = `${diagnostic.code}\u0000${diagnostic.message}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Errors of the new text that the current one did not have (offsets move, messages don't). */
function newErrors(before: AnalyzeResult, after: AnalyzeResult): readonly Diagnostic[] {
  if (after.ok) return [];
  const known = errorKeys(before);
  return after.diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}\u0000${diagnostic.message}`;
    const left = known.get(key) ?? 0;
    if (left === 0) return true;
    known.set(key, left - 1);
    return false;
  });
}

export function propose(
  before: string,
  after: string,
  options: ProposeOptions,
  analyze: (source: string) => AnalyzeResult,
): CommandOutcome {
  if (after === before) return info(strings.noChange);
  const [introduced] = newErrors(analyze(before), analyze(after));
  // Refused: the text stays as it is, and the analysis says why.
  if (introduced !== undefined) return error(introduced.message);
  const diff = lineDiff(before, after);
  const needsPreview = options.destructive || changedLineCount(diff) > 1;
  return { kind: "edit", proposal: { before, after, title: options.title, summary: options.summary, diff, needsPreview } };
}
