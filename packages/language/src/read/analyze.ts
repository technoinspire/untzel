// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentRegistry, Program } from "@untzel/core";
import { DiagnosticList, diagnosticOf, type Diagnostic, type DiagnosticCode, type DiagnosticMessage, type Range } from "../diagnostics/diagnostics";
import { MAX_SOURCE_LENGTH } from "../limits";
import { messages } from "../copy/messages";
import { parser } from "./parser";
import { treeToProgram } from "./tree-to-program";

export type AnalyzeResult =
  | {
      readonly ok: true;
      readonly program: Program;
      readonly warnings: readonly Diagnostic[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly Diagnostic[];
      /** Set only with INTERNAL_ERROR: the unexpected exception, for the caller to log. */
      readonly internalError?: unknown;
    };

export { MAX_SOURCE_LENGTH };

function single(code: DiagnosticCode, ref: DiagnosticMessage, range: Range): readonly Diagnostic[] {
  return [diagnosticOf(code, ref, range, "error")];
}

/**
 * Text -> Program. Never throws: an unexpected exception becomes INTERNAL_ERROR at 0..0.
 * Order: length, syntax, semantics; collects every error. Never executes the text.
 */
export function analyze(source: string, registry: InstrumentRegistry): AnalyzeResult {
  try {
    if (source.length > MAX_SOURCE_LENGTH) {
      const ref = messages.sourceTooLong(MAX_SOURCE_LENGTH);
      return { ok: false, diagnostics: single("SOURCE_TOO_LONG", ref, { from: MAX_SOURCE_LENGTH, to: source.length }) };
    }
    const diagnostics = new DiagnosticList();
    const program = treeToProgram(source, parser.parse(source), registry, diagnostics);
    if (program === null) return { ok: false, diagnostics: diagnostics.all() };
    // An empty text, or one with only comments, is valid and silent: say so.
    if (program.tracks.length === 0) diagnostics.warning("NOTHING_TO_PLAY", messages.nothingToPlay(), { from: 0, to: 0 });
    return { ok: true, program, warnings: diagnostics.warnings() };
  } catch (error: unknown) {
    const diagnostics = single("INTERNAL_ERROR", messages.internalError(), { from: 0, to: 0 });
    return { ok: false, diagnostics, internalError: error };
  }
}
