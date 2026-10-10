// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Diagnostic } from "@untzel/language";
import { messageText, strings } from "../copy/copy";

// What a screen reader hears when the code goes wrong: the first
// error that was not there before, once. Typing around an error moves its offsets, so
// an error is known by its code and message, not by where it sits.

/** Identifies an error across edits that only move it. */
export function heardKey(diagnostic: Diagnostic): string {
  return `${diagnostic.code}:${diagnostic.message}`;
}

/** "Line 5: No instrument named "kik". The previous version keeps playing."; null when nothing is new. */
export function nextAnnouncement(
  heard: ReadonlySet<string>,
  errors: readonly Diagnostic[],
  lineOf: (offset: number) => number,
): string | null {
  const fresh = errors.find((diagnostic) => !heard.has(heardKey(diagnostic)));
  return fresh === undefined ? null : strings.problemAt(lineOf(fresh.from), messageText(fresh));
}
