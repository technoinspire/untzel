// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainToWorkerMessage } from "../protocol";
import { COMMAND_WATCH_TIMEOUT_MS, CommandWatchSlot, type CommandWatcher, type ReceiptMessage } from "./command-watch";

const REAFFIRMATION: readonly MainToWorkerMessage[] = [{ type: "background", isHidden: false }];

class RecordingWatcher implements CommandWatcher {
  readonly sentTypes: string[] = [];
  readonly receipts: ReceiptMessage[] = [];
  losses = 0;
  sent(message: MainToWorkerMessage): void {
    this.sentTypes.push(message.type);
  }
  received(receipt: ReceiptMessage): void {
    this.receipts.push(receipt);
  }
  lost(): void {
    this.losses += 1;
  }
}

function receipt(command: ReceiptMessage["command"], frame: number): ReceiptMessage {
  return { type: "receipt", command, frame, horizon: null, after: null };
}

/** A slot over a fake port: what was posted, in order, as the port's #toWorker would. */
function setup() {
  const posted: MainToWorkerMessage[] = [];
  const slot: CommandWatchSlot = new CommandWatchSlot({
    send: (message) => {
      slot.sent(message);
      posted.push(message);
    },
    reaffirmation: () => REAFFIRMATION,
  });
  return { slot, posted };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("CommandWatchSlot", () => {
  it("arms, reaffirms and reports every later command and receipt in order", () => {
    const { slot, posted } = setup();
    const watcher = new RecordingWatcher();
    slot.watchCommands(watcher);
    slot.sent({ type: "stop" });
    slot.received(receipt("receipts", 1));
    slot.received(receipt("background", 1));
    expect(posted).toEqual([{ type: "receipts", isOn: true }, ...REAFFIRMATION]);
    expect(watcher.sentTypes).toEqual(["receipts", "background", "stop"]);
    expect(watcher.receipts.map(({ command }) => command)).toEqual(["receipts", "background"]);
  });
  it("throws on a second watch while one is active", () => {
    const { slot } = setup();
    slot.watchCommands(new RecordingWatcher());
    expect(() => slot.watchCommands(new RecordingWatcher())).toThrow(new Error("a command watch is already active"));
  });
  it("resolves stop() with the disarm receipt, the arm's own receipt not mistaken for it", async () => {
    const { slot, posted } = setup();
    const watcher = new RecordingWatcher();
    const watch = slot.watchCommands(watcher);
    const stopped = watch.stop();
    expect(watch.stop()).toBe(stopped);
    expect(posted.at(-1)).toEqual({ type: "receipts", isOn: false });
    slot.sent({ type: "play", mode: "loop" }); // after the disarm: no receipt, not reported
    slot.received(receipt("receipts", 10));
    slot.received(receipt("background", 10));
    slot.received(receipt("receipts", 20));
    await expect(stopped).resolves.toEqual(receipt("receipts", 20));
    expect(watcher.sentTypes).toEqual(["receipts", "background", "receipts"]);
    expect(watcher.receipts).toHaveLength(3);
    slot.watchCommands(new RecordingWatcher()); // idle again
  });
  it("resolves stop() with null after the timeout", async () => {
    const { slot } = setup();
    const watch = slot.watchCommands(new RecordingWatcher());
    slot.received(receipt("receipts", 1));
    const stopped = watch.stop();
    vi.advanceTimersByTime(COMMAND_WATCH_TIMEOUT_MS);
    await expect(stopped).resolves.toBeNull();
  });
  it("calls lost() and resolves a pending stop() with null when the engine goes", async () => {
    const { slot } = setup();
    const watcher = new RecordingWatcher();
    const stopped = slot.watchCommands(watcher).stop();
    slot.lost();
    await expect(stopped).resolves.toBeNull();
    expect(watcher.losses).toBe(1);
    slot.received(receipt("receipts", 1));
    expect(watcher.receipts).toEqual([]);
  });
});

describe("CommandWatchSlot draining after a stop that timed out", () => {
  function timedOut() {
    const run = setup();
    const old = new RecordingWatcher();
    const stopped = run.slot.watchCommands(old).stop();
    run.slot.received(receipt("receipts", 1)); // the arm
    vi.advanceTimersByTime(COMMAND_WATCH_TIMEOUT_MS);
    return { ...run, old, stopped };
  }
  it("drops the late disarm, never pairing it with the next arm", async () => {
    const { slot, posted, old, stopped } = timedOut();
    await expect(stopped).resolves.toBeNull();
    const next = new RecordingWatcher();
    slot.watchCommands(next);
    expect(posted.filter((message) => message.type === "receipts")).toHaveLength(2); // arm and disarm of the old one
    slot.received(receipt("receipts", 50)); // the old disarm, late
    expect(next.receipts).toEqual([]);
    expect(old.receipts).toHaveLength(1);
    expect(posted.at(-2)).toEqual({ type: "receipts", isOn: true });
    expect(next.sentTypes).toEqual(["receipts", "background"]);
    slot.received(receipt("receipts", 60)); // the new arm
    expect(next.receipts).toEqual([receipt("receipts", 60)]);
  });
  it("sends receipts on only once the drain ends", () => {
    const { slot, posted } = timedOut();
    const sent = posted.length;
    slot.watchCommands(new RecordingWatcher());
    expect(posted).toHaveLength(sent);
    slot.received(receipt("stop", 40)); // dropped
    expect(posted).toHaveLength(sent);
    slot.received(receipt("receipts", 50));
    expect(posted.slice(sent)).toEqual([{ type: "receipts", isOn: true }, ...REAFFIRMATION]);
  });
  it("drops the arm and the disarm when the stop timed out before the arm's receipt", () => {
    const { slot } = setup();
    slot.watchCommands(new RecordingWatcher()).stop();
    vi.advanceTimersByTime(COMMAND_WATCH_TIMEOUT_MS);
    const next = new RecordingWatcher();
    slot.watchCommands(next);
    slot.received(receipt("receipts", 1));
    expect(next.sentTypes).toEqual([]);
    slot.received(receipt("receipts", 2));
    expect(next.sentTypes).toEqual(["receipts", "background"]);
  });
  it("gives lost() to the new watcher when the drain does not end in 1 000 ms", () => {
    const { slot, posted } = timedOut();
    const next = new RecordingWatcher();
    slot.watchCommands(next);
    const sent = posted.length;
    vi.advanceTimersByTime(COMMAND_WATCH_TIMEOUT_MS - 1);
    expect(next.losses).toBe(0);
    vi.advanceTimersByTime(1);
    expect(next.losses).toBe(1);
    expect(posted).toHaveLength(sent);
    slot.watchCommands(new RecordingWatcher()); // idle again
  });
  it("goes back to idle on lost()", () => {
    const { slot, posted } = timedOut();
    slot.lost();
    const sent = posted.length;
    slot.watchCommands(new RecordingWatcher());
    expect(posted.slice(sent)).toEqual([{ type: "receipts", isOn: true }, ...REAFFIRMATION]);
  });
  it("throws on a second watch while one waits for the drain", () => {
    const { slot } = timedOut();
    slot.watchCommands(new RecordingWatcher());
    expect(() => slot.watchCommands(new RecordingWatcher())).toThrow("a command watch is already active");
  });
});
