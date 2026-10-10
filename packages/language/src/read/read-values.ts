// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { compare, div, fromDecimal, mul, rational, toNumber, type Rational, type WrittenValue } from "@untzel/core";
import type { DiagnosticList, DiagnosticMessage } from "../diagnostics/diagnostics";
import { MAX_SIGNAL_PERIOD } from "../limits";
import { clampFix, rangeFix, valueFix } from "../diagnostics/fixes";
import { messages } from "../copy/messages";
import type { ModifierSyntax, PeriodSyntax, Token } from "../highlight/outline";

/** What a numeric modifier accepts. */
export interface NumericRule {
  /** Name shown in messages. */
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly integer: boolean;
  readonly allowsSignal: boolean;
  /**
   * Whether a fast signal (period below one bar) or `env` may drive it: instrument and
   * effect parameters, `gain` and `pan`.
   */
  readonly allowsFast?: boolean;
  /** Full example for MISSING_VALUE, for example "gain 0.8". */
  readonly example: string;
}

const ONE_BAR = rational(1n, 1n);
const FASTEST = rational(1n, 64n);
const MIN_ENVELOPE_SECONDS = 0.005;
const MAX_ENVELOPE_SECONDS = 10;

/** Exact value of a Number token; the grammar guarantees the decimal form. */
export function exactNumber(token: Token): Rational {
  return fromDecimal(token.text) ?? rational(0n, 1n);
}

export function numberOf(token: Token): number {
  return toNumber(exactNumber(token));
}

function fits(rule: NumericRule, value: number): boolean {
  return value >= rule.min && value <= rule.max && (!rule.integer || Number.isInteger(value));
}

function rangeMessage(rule: NumericRule): DiagnosticMessage {
  return rule.integer
    ? messages.wholeBetween(rule.name, rule.min, rule.max)
    : messages.between(rule.name, rule.min, rule.max);
}

/** A Number token checked against a rule; null (with a diagnostic) when it does not fit. */
export function readConstant(
  token: Token,
  rule: NumericRule,
  diagnostics: DiagnosticList,
  message: DiagnosticMessage = rangeMessage(rule),
): number | null {
  const value = numberOf(token);
  if (fits(rule, value)) return value;
  diagnostics.error("OUT_OF_RANGE", message, token, clampFix(token, value, rule));
  return null;
}

/** Exact period in bars of `sine(8)` or `sine(1/8)`; null when it is not a positive value. */
function periodOf(period: PeriodSyntax): Rational | null {
  if (period.kind === "number") return exactNumber(period.number);
  const numerator = exactNumber(period.numerator);
  const denominator = exactNumber(period.denominator);
  if (toNumber(denominator) === 0) return null;
  return div(numerator, denominator);
}

type SignalSyntax = Extract<NonNullable<ModifierSyntax["value"]>, { kind: "signal" }>;

function readRange(
  value: SignalSyntax,
  rule: NumericRule,
  diagnostics: DiagnosticList,
): { readonly low: number; readonly high: number } | null {
  if (value.range === null) {
    const example = `${rule.min}..${rule.max}`;
    diagnostics.error("SIGNAL_NEEDS_RANGE", messages.signalNeedsRange(value.signal.text, example), value.signal, rangeFix(value.signal, rule));
    return null;
  }
  const low = readConstant(value.range.low, { ...rule, integer: false }, diagnostics);
  const high = readConstant(value.range.high, { ...rule, integer: false }, diagnostics);
  return low === null || high === null ? null : { low, high };
}

/** `env(s) a..b`: a per-note envelope run by the DSP. */
function readEnvelope(value: SignalSyntax, rule: NumericRule, diagnostics: DiagnosticList): WrittenValue | null {
  const period = value.period;
  const seconds = period?.kind === "number" ? numberOf(period.number) : Number.NaN;
  const secondsOk = seconds >= MIN_ENVELOPE_SECONDS && seconds <= MAX_ENVELOPE_SECONDS;
  if (!secondsOk) {
    diagnostics.error("OUT_OF_RANGE", messages.envelopeSeconds(MIN_ENVELOPE_SECONDS, MAX_ENVELOPE_SECONDS), period ?? value.signal);
  }
  if (rule.allowsFast !== true) {
    diagnostics.error("OUT_OF_RANGE", messages.slowSignalOnly(rule.name), value.signal);
    return null;
  }
  const range = readRange(value, rule, diagnostics);
  if (!secondsOk || range === null) return null;
  return { kind: "envelope", seconds, from: range.low, to: range.high };
}

/** Written like a signal shape, read as an envelope. */
export const ENVELOPE_SHAPE = "env";

// Over 40 lines: the signal's checks in the order its diagnostics must come, each one returning.
function readSignal(value: SignalSyntax, rule: NumericRule, diagnostics: DiagnosticList): WrittenValue | null {
  if (!rule.allowsSignal) {
    // A fixed value holds for the whole track or section.
    diagnostics.error("SIGNAL_NOT_ALLOWED", messages.noSignal(rule.name), value.signal);
    return null;
  }
  if (value.shape === ENVELOPE_SHAPE) return readEnvelope(value, rule, diagnostics);
  const shape = value.shape;
  const period = value.period === null ? null : periodOf(value.period);
  const anchor = value.period ?? value.signal;
  const positive = period !== null && toNumber(period) > 0 && toNumber(period) <= MAX_SIGNAL_PERIOD;
  if (!positive) {
    diagnostics.error("OUT_OF_RANGE", messages.signalPeriod(MAX_SIGNAL_PERIOD), anchor);
    readRange(value, rule, diagnostics);
    return null;
  }
  // The value decides where it runs. Below one bar it is a DSP modulator, except
  // rand, which stays in the transport and needs a multiple of 1/16.
  const fast = compare(period, ONE_BAR) < 0;
  if (fast && shape === "rand") {
    const sixteenths = toNumber(mul(period, rational(16n, 1n)));
    if (!Number.isInteger(sixteenths)) {
      diagnostics.error("OUT_OF_RANGE", messages.randDivision(), anchor);
      return null;
    }
  } else if (fast) {
    if (compare(period, FASTEST) < 0) {
      diagnostics.error("OUT_OF_RANGE", messages.fastPeriod(), anchor);
      return null;
    }
    if (rule.allowsFast !== true) {
      diagnostics.error("OUT_OF_RANGE", messages.slowSignalOnly(rule.name), value.signal);
      return null;
    }
  }
  const range = readRange(value, rule, diagnostics);
  if (range === null) return null;
  if (fast && shape !== "rand") {
    return { kind: "fast", shape, periodBars: period, from: range.low, to: range.high };
  }
  return { kind: "signal", signal: { shape, periodBars: period }, from: range.low, to: range.high };
}

/** The value of a numeric modifier: a number or a signal with a range. */
export function readNumericValue(
  modifier: ModifierSyntax,
  rule: NumericRule,
  diagnostics: DiagnosticList,
): WrittenValue | null {
  const { value } = modifier;
  if (value === null) {
    diagnostics.error("MISSING_VALUE", messages.missingValue(rule.name, rule.example), modifier.name, valueFix(modifier.name, rule.example));
    return null;
  }
  if (value.kind === "signal") return readSignal(value, rule, diagnostics);
  if (value.kind === "number") {
    const constant = readConstant(value.number, rule, diagnostics);
    return constant === null ? null : { kind: "constant", value: constant };
  }
  diagnostics.error("OUT_OF_RANGE", rangeMessage(rule), value);
  return null;
}
