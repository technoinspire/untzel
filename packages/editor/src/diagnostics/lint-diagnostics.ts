// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Diagnostic as LintDiagnostic } from "@codemirror/lint";
import type { Diagnostic, DiagnosticFix } from "@untzel/language";
import { fixTitle, messageText } from "../copy/copy";

// The session's diagnostics as CodeMirror lint diagnostics: the
// analysis already ran, so nothing is parsed again here. A known fix becomes an action.

/** Ranges clamped to the document, with the fix as the diagnostic's action. */
export function toLintDiagnostics(
  diagnostics: readonly Diagnostic[],
  length: number,
  applyFix: (fix: DiagnosticFix) => void,
): LintDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const from = Math.min(Math.max(0, diagnostic.from), length);
    const to = Math.min(Math.max(from, diagnostic.to), length);
    const { fix } = diagnostic;
    return {
      from,
      to,
      severity: diagnostic.severity,
      message: messageText(diagnostic),
      source: diagnostic.code,
      ...(fix === undefined ? {} : { actions: [{ name: fixTitle(fix), apply: () => applyFix(fix) }] }),
    };
  });
}

/** Mod+.: the fix under the cursor, else the first fix of the text. */
export function firstFix(diagnostics: readonly Diagnostic[], offset: number): DiagnosticFix | null {
  const withFix = diagnostics.filter((diagnostic) => diagnostic.fix !== undefined);
  const under = withFix.find((diagnostic) => offset >= diagnostic.from && offset <= diagnostic.to);
  return (under ?? withFix[0])?.fix ?? null;
}
