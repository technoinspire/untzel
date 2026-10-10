// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  MAX_LOOP_BARS,
  MIN_LOOP_BARS,
  rational,
  SCALE_NAMES,
  tonicToPitchClass,
  type Key,
  type Rational,
} from "@untzel/core";
import type { DiagnosticList } from "../diagnostics/diagnostics";
import { DEFAULT_TEMPO, MAX_SWING, MAX_TEMPO, MIN_TEMPO } from "../limits";
import type { LineIndex } from "./lines";
import { suggestionFix } from "../diagnostics/fixes";
import { messages } from "../copy/messages";
import type { KeySyntax, LoopSyntax, StatementSyntax, SwingSyntax, TempoSyntax } from "../highlight/outline";
import { exactNumber, readConstant, type NumericRule } from "./read-values";
import { closest } from "../diagnostics/suggest";

export interface Globals {
  readonly tempo: Rational;
  readonly key: Key;
  readonly swing: Rational;
  /** `loop <bars>`; null when absent. */
  readonly loopBars: number | null;
}

type GlobalSyntax = TempoSyntax | KeySyntax | SwingSyntax | LoopSyntax;

export const TEMPO_RULE: NumericRule = {
  name: "tempo",
  min: MIN_TEMPO,
  max: MAX_TEMPO,
  integer: false,
  allowsSignal: false,
  example: "tempo 132",
};

export const SWING_RULE: NumericRule = {
  name: "swing",
  min: 0,
  max: MAX_SWING,
  integer: false,
  allowsSignal: false,
  example: "swing 0.12",
};

/** Bars of one pass in loop mode. */
export const LOOP_RULE: NumericRule = {
  name: "loop",
  min: MIN_LOOP_BARS,
  max: MAX_LOOP_BARS,
  integer: true,
  allowsSignal: false,
  example: "loop 8",
};

const DEFAULTS: Globals = {
  tempo: rational(BigInt(DEFAULT_TEMPO), 1n),
  key: { tonic: 0, scale: "minor" },
  swing: rational(0n, 1n),
  loopBars: null,
};

function isGlobal(statement: StatementSyntax): statement is GlobalSyntax {
  return (
    statement.kind === "tempo" || statement.kind === "key" || statement.kind === "swing" || statement.kind === "loop"
  );
}

/** Each global at most once; the first one counts. */
function firstOfEach(
  statements: readonly StatementSyntax[],
  lines: LineIndex,
  diagnostics: DiagnosticList,
): readonly GlobalSyntax[] {
  const seen = new Map<string, GlobalSyntax>();
  for (const statement of statements.filter(isGlobal)) {
    const first = seen.get(statement.kind);
    if (first === undefined) {
      seen.set(statement.kind, statement);
      continue;
    }
    const message = messages.duplicateStatement(statement.kind, lines.lineNumber(first.from));
    diagnostics.error("DUPLICATE_STATEMENT", message, statement.head);
  }
  return [...seen.values()];
}

function readKey(statement: KeySyntax, diagnostics: DiagnosticList): Key | null {
  const tonic = tonicToPitchClass(statement.tonic.text);
  const scale = SCALE_NAMES.find((name) => name === statement.scale.text);
  if (scale === undefined) {
    const suggestion = closest(statement.scale.text, SCALE_NAMES);
    const message = messages.unknownScale(statement.scale.text, suggestion?.text ?? null);
    diagnostics.error("UNKNOWN_SCALE", message, statement.scale, suggestionFix(statement.scale, suggestion));
  }
  return tonic === null || scale === undefined ? null : { tonic, scale };
}

/** tempo, key, swing and loop, with their defaults. */
export function readGlobals(
  statements: readonly StatementSyntax[],
  lines: LineIndex,
  diagnostics: DiagnosticList,
): Globals {
  let globals = DEFAULTS;
  for (const statement of firstOfEach(statements, lines, diagnostics)) {
    if (statement.kind === "key") {
      const key = readKey(statement, diagnostics);
      if (key !== null) globals = { ...globals, key };
      continue;
    }
    if (statement.kind === "loop") {
      const bars = readConstant(statement.value, LOOP_RULE, diagnostics);
      if (bars !== null) globals = { ...globals, loopBars: bars };
      continue;
    }
    const rule = statement.kind === "tempo" ? TEMPO_RULE : SWING_RULE;
    if (readConstant(statement.value, rule, diagnostics) === null) continue;
    globals = { ...globals, [statement.kind]: exactNumber(statement.value) };
  }
  return globals;
}
