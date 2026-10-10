// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { AnalyzeResult, Diagnostic, DiagnosticFix, TextChange } from "@untzel/language";

// `fix`: every safe quick fix the analysis attached, in one edit.

/** A fix can reveal the next problem (a value written after a typo is fixed). */
const MAX_PASSES = 4;

export interface FixAllResult {
  readonly source: string;
  readonly count: number;
}

function apply(source: string, changes: readonly TextChange[]): string {
  let text = source;
  for (const change of [...changes].sort((a, b) => b.from - a.from)) {
    text = text.slice(0, change.from) + change.insert + text.slice(change.to);
  }
  return text;
}

function span(fix: DiagnosticFix): { from: number; to: number } {
  return {
    from: Math.min(...fix.changes.map((change) => change.from)),
    to: Math.max(...fix.changes.map((change) => change.to)),
  };
}

/** Safe fixes that do not touch each other, in text order. */
function compatibleFixes(diagnostics: readonly Diagnostic[]): readonly DiagnosticFix[] {
  const fixes = diagnostics
    .flatMap((diagnostic) => (diagnostic.fix?.safe === true && diagnostic.fix.changes.length > 0 ? [diagnostic.fix] : []))
    .sort((a, b) => span(a).from - span(b).from);
  const picked: DiagnosticFix[] = [];
  let end = -1;
  for (const fix of fixes) {
    const { from, to } = span(fix);
    if (from <= end) continue;
    picked.push(fix);
    end = to;
  }
  return picked;
}

export function applySafeFixes(source: string, analyze: (source: string) => AnalyzeResult): FixAllResult {
  let text = source;
  let count = 0;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const result = analyze(text);
    const fixes = compatibleFixes(result.ok ? result.warnings : result.diagnostics);
    if (fixes.length === 0) break;
    text = apply(text, fixes.flatMap((fix) => fix.changes));
    count += fixes.length;
  }
  return { source: text, count };
}
