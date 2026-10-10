// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { MAX_TAKE_ENTRIES, MAX_TAKE_TEXT_CHARS } from "./take";
import { TakeRecorder, type CommandReceipt, type SentCommand, type TakeRecorderOptions } from "./take-recorder";

const SR = 48_000;
const ARM = 10_000;
const START = 16_000;
const BACKGROUND_AHEAD = 2 * SR;

function recorder(options: Partial<TakeRecorderOptions> = {}): TakeRecorder {
  return new TakeRecorder({ sampleRate: SR, capSeconds: 60, includesAuditions: false, ...options });
}
function receipt(command: string, frame: number | null, horizon: number | null = null, after: number | null = null): CommandReceipt {
  return { command, frame, horizon, after };
}
function sounding(source: string, instruments: readonly string[] = ["kick"]): SentCommand {
  return { kind: "sounding", recipe: { source, solo: null, preview: null }, instruments };
}
/** Armed, a program loaded and a play that started at START. */
function playing(options: Partial<TakeRecorderOptions> = {}): TakeRecorder {
  const take = recorder(options);
  take.sent({ kind: "arm" });
  take.sent(sounding("kick x..."));
  take.sent({ kind: "play", mode: "loop", startBar: null });
  expect(take.received(receipt("receipts", ARM))).toBe("recorded");
  expect(take.received(receipt("load", ARM))).toBe("recorded");
  expect(take.received(receipt("play", ARM + 100, null, START))).toBe("recorded");
  return take;
}

describe("TakeRecorder pairing", () => {
  it("pairs each receipt with the first command sent, by command name", () => {
    const pairs: readonly [SentCommand, string][] = [
      [sounding("a"), "load"],
      [{ kind: "play", mode: "loop", startBar: null }, "play"],
      [{ kind: "mode", mode: "song" }, "setMode"],
      [{ kind: "stop" }, "stop"],
      [{ kind: "range", change: { mode: "loop", range: null, locate: false } }, "setPlayRange"],
      [{ kind: "background", isHidden: true }, "background"],
      [{ kind: "audition", program: {} as never }, "preview"],
      [{ kind: "auditionNote", program: {} as never, midis: [60], seconds: 0.5 }, "previewNote"],
      [{ kind: "auditionStop" }, "previewStop"],
      [{ kind: "disarm" }, "receipts"],
    ];
    for (const [command, name] of pairs) {
      const matched = recorder();
      matched.sent({ kind: "arm" });
      matched.sent(command);
      matched.received(receipt("receipts", ARM));
      expect(matched.received(receipt(name, ARM + 1))).not.toBe("mismatch");
      const crossed = recorder();
      crossed.sent({ kind: "arm" });
      crossed.sent(command);
      crossed.received(receipt("receipts", ARM));
      expect(crossed.received(receipt(name === "stop" ? "play" : "stop", ARM + 1))).toBe("mismatch");
    }
  });
  it("takes the arm receipt's frame as armFrame and wants it first", () => {
    const take = playing();
    expect(take.finish("stop", START + 2 * SR, null)?.armFrame).toBe(ARM);
    const early = recorder();
    early.sent(sounding("a"));
    early.sent({ kind: "arm" });
    expect(early.received(receipt("load", ARM))).toBe("mismatch");
    const twice = recorder();
    twice.sent({ kind: "arm" });
    twice.sent({ kind: "arm" });
    twice.received(receipt("receipts", ARM));
    expect(twice.received(receipt("receipts", ARM))).toBe("mismatch");
  });
  it("calls a receipt without a frame, or with nothing sent, a mismatch", () => {
    const take = recorder();
    take.sent({ kind: "arm" });
    expect(take.received(receipt("receipts", null))).toBe("mismatch");
    expect(recorder().received(receipt("receipts", ARM))).toBe("mismatch");
    const later = playing();
    later.sent({ kind: "mode", mode: "song" });
    expect(later.received(receipt("setMode", null, START))).toBe("mismatch");
  });
});

describe("TakeRecorder monotonic rules", () => {
  it("calls a frame that descends a mismatch", () => {
    const take = playing();
    take.sent({ kind: "mode", mode: "song" });
    expect(take.received(receipt("setMode", ARM + 99, START + 5_760))).toBe("mismatch");
  });
  it("calls a frame below the arm a mismatch", () => {
    const take = recorder();
    take.sent({ kind: "arm" });
    take.sent({ kind: "stop" });
    take.received(receipt("receipts", ARM));
    expect(take.received(receipt("stop", ARM - 1))).toBe("mismatch");
  });
  it("calls a horizon that descends without a null between a mismatch", () => {
    const take = playing();
    take.sent({ kind: "mode", mode: "song" });
    take.sent({ kind: "background", isHidden: true });
    expect(take.received(receipt("setMode", ARM + 200, START + 9_000, START + 9_000))).toBe("recorded");
    expect(take.received(receipt("background", ARM + 300, START + 8_999, START + 8_999))).toBe("mismatch");
  });
  it("accepts a stop while hidden, then background false and a play that starts below the old horizon", () => {
    const take = playing();
    const stopAt = START + 4 * SR;
    take.sent({ kind: "background", isHidden: true });
    take.sent({ kind: "stop" });
    take.sent({ kind: "background", isHidden: false });
    take.sent({ kind: "play", mode: "loop", startBar: null });
    expect(take.received(receipt("background", stopAt - 1_000, stopAt, stopAt))).toBe("recorded");
    expect(take.received(receipt("stop", stopAt, stopAt + BACKGROUND_AHEAD))).toBe("recorded");
    expect(take.received(receipt("background", stopAt + 10))).toBe("recorded");
    const restart = stopAt + 6_016;
    expect(restart).toBeLessThan(stopAt + BACKGROUND_AHEAD);
    expect(take.received(receipt("play", stopAt + 20, null, restart))).toBe("recorded");
    const entries = take.finish("stop", stopAt + SR, null)?.entries ?? [];
    expect(entries.at(-1)?.startFrame).toBe(restart);
  });
});

describe("TakeRecorder first sound", () => {
  it("fixes t0 on the first play that started the music", () => {
    const take = recorder();
    take.sent({ kind: "arm" });
    take.sent({ kind: "play", mode: "loop", startBar: null });
    take.sent(sounding("a"));
    take.sent({ kind: "play", mode: "loop", startBar: null });
    take.sent({ kind: "play", mode: "song", startBar: null });
    take.received(receipt("receipts", ARM));
    expect(take.received(receipt("play", ARM + 1))).toBe("recorded");
    expect(take.firstSoundFrame()).toBeNull();
    take.received(receipt("load", ARM + 2));
    take.received(receipt("play", ARM + 3, null, START));
    expect(take.firstSoundFrame()).toBe(START);
    take.received(receipt("play", ARM + 4, START, START));
    const entries = take.finish("stop", START + SR, null)?.entries ?? [];
    expect(entries.map((entry) => entry.startFrame)).toEqual([undefined, undefined, START, undefined]);
  });
  it("caps exactly at t0 + cap", () => {
    const take = playing({ capSeconds: 2 });
    const cap = START + 2 * SR;
    expect(take.capFrame()).toBe(cap);
    take.sent({ kind: "mode", mode: "song" });
    take.sent({ kind: "stop" });
    take.sent({ kind: "disarm" });
    expect(take.received(receipt("setMode", cap - 1, START + 1))).toBe("recorded");
    expect(take.received(receipt("stop", cap, START + 2))).toBe("capped");
    expect(take.received(receipt("receipts", cap + SR))).toBe("disarmed");
    const done = take.finish("cap", cap + SR, null);
    expect(done?.endFrame).toBe(cap);
    expect(done?.entries.map((entry) => entry.command.kind)).toEqual(["sounding", "play", "mode"]);
  });
  it("clamps elapsedSeconds between 0 and the cap", () => {
    const take = playing({ capSeconds: 2 });
    expect(recorder().elapsedSeconds(START)).toBe(0);
    expect(take.elapsedSeconds(START - SR)).toBe(0);
    expect(take.elapsedSeconds(START + SR / 2)).toBe(0.5);
    expect(take.elapsedSeconds(START + 10 * SR)).toBe(2);
  });
});

describe("TakeRecorder limits", () => {
  it("is full past MAX_TAKE_TEXT_CHARS of text", () => {
    const take = playing();
    const long = "x".repeat(MAX_TAKE_TEXT_CHARS);
    take.sent(sounding(long));
    expect(take.received(receipt("load", ARM + 200, START))).toBe("full");
    take.sent({ kind: "stop" });
    expect(take.received(receipt("stop", ARM + 300, START))).toBe("full");
    expect(take.lastFrame()).toBe(ARM + 100);
  });
  it("is full at MAX_TAKE_ENTRIES entries", () => {
    const take = playing();
    const count = MAX_TAKE_ENTRIES - 2;
    for (let index = 0; index < count; index += 1) take.sent({ kind: "mode", mode: "loop" });
    for (let index = 0; index < count; index += 1) take.received(receipt("setMode", ARM + 200 + index, START));
    take.sent({ kind: "mode", mode: "loop" });
    expect(take.received(receipt("setMode", ARM + 200 + count, START))).toBe("full");
    expect(take.finish("full", take.lastFrame() + 2 * SR, null)?.entries).toHaveLength(MAX_TAKE_ENTRIES);
  });
  it("leaves the audition out unless the demo includes it", () => {
    const audition: SentCommand = { kind: "auditionNote", program: {} as never, midis: [60], seconds: 0.5 };
    for (const includesAuditions of [false, true]) {
      const take = playing({ includesAuditions });
      take.sent(audition);
      take.sent({ kind: "auditionStop" });
      expect(take.received(receipt("previewNote", ARM + 200, START))).toBe("recorded");
      expect(take.received(receipt("previewStop", ARM + 300, START))).toBe("recorded");
      const kinds = take.finish("stop", START + SR, null)?.entries.map((entry) => entry.command.kind);
      expect(kinds).toEqual(includesAuditions ? ["sounding", "play", "auditionNote", "auditionStop"] : ["sounding", "play"]);
    }
  });
});

describe("TakeRecorder finish", () => {
  it("answers the disarm with disarmed", () => {
    const take = playing();
    take.sent({ kind: "disarm" });
    expect(take.received(receipt("receipts", START + SR, START + SR))).toBe("disarmed");
    expect(take.lastFrame()).toBe(START + SR);
  });
  it("is null without t0 and under a second from t0", () => {
    const silent = recorder();
    silent.sent({ kind: "arm" });
    silent.received(receipt("receipts", ARM));
    expect(silent.finish("stop", ARM + 10 * SR, null)).toBeNull();
    expect(playing().finish("stop", START + SR - 1, null)).toBeNull();
    expect(playing().finish("stop", START + SR, null)).not.toBeNull();
  });
  it("closes the take with its text as diffs, instruments and title", () => {
    const take = playing();
    take.sent(sounding("kick x.x.", ["kick", "hat"]));
    take.received(receipt("load", ARM + 200, START));
    const done = take.finish("stop", START + 3 * SR, "Night");
    expect(done).toMatchObject({ format: "untzel-take", version: 1, sampleRate: SR, armFrame: ARM, endFrame: START + 3 * SR, endedBy: "stop", title: "Night" });
    expect(done?.instruments).toEqual(["kick", "hat"]);
    expect(done?.entries.at(-1)).toEqual({
      command: { kind: "sounding", source: { at: 7, remove: 1, insert: "x" }, solo: null, preview: null },
      frame: ARM + 200,
      horizon: START,
    });
  });
});
