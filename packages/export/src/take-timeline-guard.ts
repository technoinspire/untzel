// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A take that cannot be rendered fails as TAKE_INVALID with its code only: a refused
// decode, or a replay error at start or while advancing. The export does not import the
// take, so its errors are read by shape: an Error with a string `code`.
import type { ExportTimeline } from "./timeline";

/** The code of a take error (TakeReplayError, a refused decode); null for any other error. */
export function takeErrorCode(error: unknown): string | null {
  if (!(error instanceof Error) || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

/**
 * A failed load of the take's timeline: a coded take error (a refused decode, a replay
 * error) becomes `refuse(code)`; any other error, such as a chunk that did not load, stays
 * as it is, so the job fails as an ordinary failure and rendering again can work.
 */
export function takeLoadFailure(error: unknown, refuse: (code: string) => Error): unknown {
  const code = takeErrorCode(error);
  return code === null ? error : refuse(code);
}
/**
 * The take's timeline with its failures turned into `refuse(code)`: every error of start
 * (nothing has sounded yet), and the coded take errors of advance; any other error of
 * advance (out of memory) keeps its own classification.
 */
export function guardTakeTimeline(timeline: ExportTimeline, refuse: (code: string) => Error): ExportTimeline {
  return {
    start(context) {
      try {
        return timeline.start(context);
      } catch (error) {
        throw refuse(takeErrorCode(error) ?? "UNPLAYABLE");
      }
    },
    advance(frame) {
      try {
        timeline.advance(frame);
      } catch (error) {
        const code = takeErrorCode(error);
        throw code === null ? error : refuse(code);
      }
    },
  };
}
