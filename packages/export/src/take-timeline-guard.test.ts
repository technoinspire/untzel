// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { guardTakeTimeline, takeErrorCode, takeLoadFailure } from "./take-timeline-guard";
import type { ExportTimeline, TimelineContext } from "./timeline";

class CodedError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`take replay: ${code} (kick x... x...)`);
    this.code = code;
  }
}
const context = { sink: null, preview: null, sampleRate: 48_000 } as unknown as TimelineContext;
const refuse = (code: string) => new Error(`refused ${code}`);
function failing(onStart: Error | null, onAdvance: Error | null): ExportTimeline {
  return {
    start() {
      if (onStart !== null) throw onStart;
      return { firstFrame: 0, musicStartFrame: 0, endsWithSong: false };
    },
    advance() {
      if (onAdvance !== null) throw onAdvance;
    },
  };
}

describe("guardTakeTimeline", () => {
  it("reads a take error's code, and nothing else, from an error", () => {
    expect(takeErrorCode(new CodedError("DIVERGED"))).toBe("DIVERGED");
    expect(takeErrorCode(new RangeError("out of memory"))).toBeNull();
    expect(takeErrorCode(Object.assign(new Error("x"), { code: 12 }))).toBeNull();
    expect(takeErrorCode("DIVERGED")).toBeNull();
  });
  it("refuses every failure at start with its code, never the message", () => {
    expect(() => guardTakeTimeline(failing(new CodedError("BAD_DIFF"), null), refuse).start(context)).toThrow("refused BAD_DIFF");
    expect(() => guardTakeTimeline(failing(new RangeError("no stretch"), null), refuse).start(context)).toThrow("refused UNPLAYABLE");
  });
  it("refuses a take error while advancing and lets any other error through", () => {
    expect(() => guardTakeTimeline(failing(null, new CodedError("DIVERGED")), refuse).advance(128)).toThrow("refused DIVERGED");
    const memory = new RangeError("Array buffer allocation failed");
    expect(() => guardTakeTimeline(failing(null, memory), refuse).advance(128)).toThrow(memory);
  });
  it("passes the start through unchanged", () => {
    expect(guardTakeTimeline(failing(null, null), refuse).start(context)).toEqual({ firstFrame: 0, musicStartFrame: 0, endsWithSong: false });
  });
});
describe("takeLoadFailure", () => {
  it("refuses a coded take error and keeps a chunk that failed to load as it is", () => {
    expect(takeLoadFailure(new CodedError("NOT_JSON"), refuse)).toEqual(new Error("refused NOT_JSON"));
    const failedImport = new TypeError("Failed to fetch dynamically imported module");
    expect(takeLoadFailure(failedImport, refuse)).toBe(failedImport);
  });
});
