// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The field readers of the take decoder: each one returns the value checked or throws a
// TakeFormatError with the failure code, which decodeTake turns into its result.

export type TakeDecodeFailure = "TOO_LARGE" | "NOT_A_TAKE" | "UNKNOWN_VERSION" | "MALFORMED";

export class TakeFormatError extends Error {
  readonly reason: TakeDecodeFailure;
  constructor(reason: TakeDecodeFailure, detail: string) {
    super(detail);
    this.name = "TakeFormatError";
    this.reason = reason;
  }
}

export type FieldRecord = Readonly<Record<string, unknown>>;

export function fail(reason: TakeDecodeFailure, detail: string): never {
  throw new TakeFormatError(reason, detail);
}

export function readRecord(value: unknown, field: string): FieldRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("MALFORMED", `${field}: not an object`);
  return value as FieldRecord;
}

export function readArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) fail("MALFORMED", `${field}: not a list`);
  return value;
}

export function readString(value: unknown, field: string): string {
  if (typeof value !== "string") fail("MALFORMED", `${field}: not a text`);
  return value;
}

export function readNullableString(value: unknown, field: string): string | null {
  return value === null ? null : readString(value, field);
}

export function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail("MALFORMED", `${field}: not a boolean`);
  return value;
}

/** An integer from `low` to `high`, both included. */
export function readInteger(value: unknown, field: string, low = 0, high = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < low || value > high) {
    fail("MALFORMED", `${field}: not an integer from ${low} to ${high}`);
  }
  return value;
}

export function readOneOf<Value extends string>(value: unknown, choices: readonly Value[], field: string): Value {
  if (!choices.includes(value as Value)) fail("MALFORMED", `${field}: not one of ${choices.join(", ")}`);
  return value as Value;
}
