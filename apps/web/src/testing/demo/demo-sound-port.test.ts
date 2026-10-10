// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { CommandWatcher, ReceiptMessage } from "@untzel/audio/main";
import { PreviewTransport, Transport } from "@untzel/transport";
import { fakeProgram, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import { DemoSoundPort } from "./demo-sound-port";
import { DEMO_SAMPLE_RATE, FrameClock } from "./frame-clock";

interface Rig {
  readonly port: DemoSoundPort;
  readonly clock: FrameClock;
  /** Moves the clock the host and the stand-in worklet read. */
  advance(ms: number): void;
}

function rig(): Rig {
  let now = 1_000;
  const clock = new FrameClock(() => now);
  const port = new DemoSoundPort({
    clock,
    instruments: ["kick"],
    createTransport: (transportClock, sink) => new Transport({ clock: transportClock, sink }),
    createPreview: (previewClock, sink) => new PreviewTransport({ clock: previewClock, sink }),
  });
  return { port, clock, advance: (ms) => (now += ms) };
}

describe("DemoSoundPort", () => {
  it("delivers the arm's receipt only after watchCommands returned", async () => {
    const { port } = rig();
    const receipts: ReceiptMessage[] = [];
    let isReturned = false;
    let early = 0;
    const watch = port.watchCommands({
      sent: () => undefined,
      received: (receipt) => {
        if (!isReturned) early += 1;
        receipts.push(receipt);
      },
      lost: () => undefined,
    });
    isReturned = true;
    expect(receipts).toEqual([]);
    await Promise.resolve();
    expect(early).toBe(0);
    expect(receipts.map((receipt) => receipt.command)).toEqual(["receipts"]);
    void watch.stop();
    port.dispose();
  });
  it("answers in the order the host posted, one reply per message", async () => {
    const { port, advance } = rig();
    const program = fakeProgram([fakeTrack("kick")]);
    port.load(program);
    const commands: string[] = [];
    port.watchCommands({ sent: () => undefined, received: (receipt) => commands.push(receipt.command), lost: () => undefined });
    port.play("loop");
    advance(30);
    port.setMode("song");
    port.stop();
    expect(commands).toEqual([]);
    for (let step = 0; step < 8; step += 1) await Promise.resolve();
    // The arm, the reaffirmation of the load, then the three commands in send order.
    expect(commands).toEqual(["receipts", "load", "play", "setMode", "stop"]);
    port.dispose();
  });
  it("reads the FrameClock as the host's clock: receipts carry its frame", async () => {
    const { port, clock, advance } = rig();
    port.load(fakeProgram([fakeTrack("kick")]));
    const receipts: ReceiptMessage[] = [];
    port.watchCommands({ sent: () => undefined, received: (receipt) => receipts.push(receipt), lost: () => undefined });
    advance(1_000);
    const atPlay = clock.nowFrame();
    port.play("loop");
    for (let step = 0; step < 8; step += 1) await Promise.resolve();
    const play = receipts.find((receipt) => receipt.command === "play");
    expect(clock.sampleRate).toBe(DEMO_SAMPLE_RATE);
    expect(atPlay).toBe(2_000 * 48);
    expect(play?.frame).toBe(atPlay);
    expect(play?.horizon).toBeNull();
    expect(play?.after).not.toBeNull();
    port.dispose();
  });
});
