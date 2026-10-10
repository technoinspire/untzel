// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ManifestIssue } from "./manifest-types";
import { isWellFormedName } from "../program/names";

// Generic readers of untrusted manifest JSON. Each one records an issue at its JSON path
// and returns a neutral value, so one pass reports every problem and never throws.

export type Fields = Readonly<Record<string, unknown>>;

export class IssueCollector {
  readonly issues: ManifestIssue[] = [];

  add(path: string, message: string): void {
    this.issues.push({ path, message });
  }
}

export function isRecord(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function readName(fields: Fields, path: string, issues: IssueCollector): string {
  const value = fields["name"];
  if (typeof value === "string" && isWellFormedName(value)) return value;
  issues.add(path, "must be a lower-case name of at most 24 characters");
  return "";
}

export function readChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
  path: string,
  issues: IssueCollector,
): T {
  if (typeof value === "string" && (choices as readonly string[]).includes(value)) {
    return value as T;
  }
  issues.add(path, `must be one of ${choices.join(", ")}`);
  return choices[0] as T;
}

export function readOptionalChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
  path: string,
  issues: IssueCollector,
): T {
  return value === undefined ? fallback : readChoice(value, choices, path, issues);
}

export function readNumber(
  value: unknown,
  path: string,
  issues: IssueCollector,
  isValid: (number: number) => boolean,
  rule: string,
): number {
  if (isFiniteNumber(value) && isValid(value)) return value;
  issues.add(path, rule);
  return 0;
}

export function readList(value: unknown, path: string, issues: IssueCollector): readonly unknown[] {
  if (Array.isArray(value)) return value;
  issues.add(path, "must be a list");
  return [];
}

export function readString(
  value: unknown,
  path: string,
  issues: IssueCollector,
  isValid: (text: string) => boolean,
  rule: string,
): string {
  if (typeof value === "string" && isValid(value)) return value;
  issues.add(path, rule);
  return "";
}

/** A pattern text: not blank and at most `max` characters (analyzed by language). */
export function readPattern(value: unknown, path: string, max: number, issues: IssueCollector): string {
  const valid = typeof value === "string" && value.trim().length > 0 && value.length <= max;
  if (!valid) issues.add(path, `must be 1 to ${max} characters`);
  return valid ? value : "";
}
