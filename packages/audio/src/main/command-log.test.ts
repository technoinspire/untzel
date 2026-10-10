// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import { describe, expect, it } from "vitest";
import type { MainToWorkerMessage } from "../protocol";
import { CommandLog } from "./command-log";

const FIRST = { sourceHash: 1 } as Program;
const SECOND = { sourceHash: 2 } as Program;

describe("CommandLog", () => {
  it("reaffirms nothing before any message", () => {
    expect(new CommandLog().reaffirmation()).toEqual([]);
  });
  it("reaffirms background, load and each mode's play range, in that order, the last of each", () => {
    const log = new CommandLog();
    const messages: MainToWorkerMessage[] = [
      { type: "setPlayRange", change: { mode: "song", range: { startBar: 8, endBar: 16, cycle: false }, locate: false } },
      { type: "load", program: FIRST },
      { type: "play", mode: "loop" },
      { type: "setPlayRange", change: { mode: "loop", range: { startBar: 0, endBar: 4, cycle: true }, locate: false } },
      { type: "background", isHidden: true },
      { type: "load", program: SECOND },
      { type: "stop" },
      { type: "background", isHidden: false },
      { type: "preview", program: FIRST },
    ];
    for (const message of messages) log.note(message);
    expect(log.reaffirmation()).toEqual([
      { type: "background", isHidden: false },
      { type: "load", program: SECOND },
      { type: "setPlayRange", change: { mode: "loop", range: { startBar: 0, endBar: 4, cycle: true }, locate: false } },
      { type: "setPlayRange", change: { mode: "song", range: { startBar: 8, endBar: 16, cycle: false }, locate: false } },
    ]);
  });
  it("keeps the messages by reference, the program uncopied", () => {
    const log = new CommandLog();
    const load: MainToWorkerMessage = { type: "load", program: FIRST };
    log.note(load);
    expect(log.reaffirmation()[0]).toBe(load);
  });
  it("reaffirms a play range with locate false, so it never asks for a jump", () => {
    const log = new CommandLog();
    log.note({ type: "setPlayRange", change: { mode: "loop", range: { startBar: 2, endBar: 6, cycle: true }, locate: true } });
    log.note({ type: "setPlayRange", change: { mode: "song", range: null, locate: true } });
    expect(log.reaffirmation()).toEqual([
      { type: "setPlayRange", change: { mode: "loop", range: { startBar: 2, endBar: 6, cycle: true }, locate: false } },
      { type: "setPlayRange", change: { mode: "song", range: null, locate: false } },
    ]);
  });
});
