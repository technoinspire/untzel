// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ReceiptMessage } from "@untzel/audio/main";
import type { MainToWorkerMessage } from "@untzel/audio/protocol";
import type { Program } from "@untzel/core";
import type { SoundingRecipe } from "@untzel/session";
import { TakeRecorder, type SentCommand } from "@untzel/take";
import { fakeProgram, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it, vi } from "vitest";
import { TakeCapture, sentCommand } from "./take-capture";

const PROGRAM: Program = fakeProgram([fakeTrack("kick"), fakeTrack("bass")]);
const RECIPE: SoundingRecipe = { source: "kick x...", solo: "kick", preview: null };
const CHANGE = { mode: "loop", range: { startBar: 1, endBar: 4 } } as unknown as Extract<MainToWorkerMessage, { type: "setPlayRange" }>["change"];

/** Each message the worker answers, and the take's command for it. */
const TRANSLATED: readonly (readonly [MainToWorkerMessage, SentCommand])[] = [
  [{ type: "load", program: PROGRAM }, { kind: "sounding", recipe: RECIPE, instruments: PROGRAM.tracks.map((track) => track.instrument) }],
  [{ type: "play", mode: "song" }, { kind: "play", mode: "song", startBar: null }],
  [{ type: "play", mode: "loop", startBar: 3 }, { kind: "play", mode: "loop", startBar: 3 }],
  [{ type: "setMode", mode: "song" }, { kind: "mode", mode: "song" }],
  [{ type: "stop" }, { kind: "stop" }],
  [{ type: "setPlayRange", change: CHANGE }, { kind: "range", change: CHANGE }],
  [{ type: "background", isHidden: true }, { kind: "background", isHidden: true }],
  [{ type: "preview", program: PROGRAM }, { kind: "audition", program: PROGRAM }],
  [{ type: "previewNote", program: PROGRAM, midis: [60, 64], seconds: 0.5 }, { kind: "auditionNote", program: PROGRAM, midis: [60, 64], seconds: 0.5 }],
  [{ type: "previewStop" }, { kind: "auditionStop" }],
  [{ type: "receipts", isOn: true }, { kind: "arm" }],
  [{ type: "receipts", isOn: false }, { kind: "disarm" }],
];

const receipt = (command: ReceiptMessage["command"], frame: number): ReceiptMessage => ({ type: "receipt", command, frame, horizon: null, after: null });

describe("sentCommand", () => {
  it.each(TRANSLATED)("%o becomes %o", (message, command) => {
    expect(sentCommand(message, () => RECIPE)).toEqual(command);
  });

  it("gives init no command: the worker answers it with no receipt", () => {
    expect(sentCommand({ type: "init" } as MainToWorkerMessage, () => RECIPE)).toBeNull();
  });
});

describe("TakeCapture", () => {
  it("reads the sounding recipe when the load is sent, not later", () => {
    const sent: SentCommand[] = [];
    let recipe: SoundingRecipe = RECIPE;
    const capture = new TakeCapture({ sent: (command) => sent.push(command), received: () => "recorded" }, { soundingRecipe: () => recipe }, { received: vi.fn(), lost: vi.fn() });
    capture.sent({ type: "load", program: PROGRAM });
    recipe = { ...RECIPE, source: "changed" };
    capture.sent({ type: "init" } as MainToWorkerMessage);
    expect(sent).toEqual([{ kind: "sounding", recipe: RECIPE, instruments: ["kick", "bass"] }]);
  });

  it("hands each receipt to the recorder and its outcome to the listener, and says when the engine is lost", () => {
    const recorder = new TakeRecorder({ sampleRate: 48_000, capSeconds: 60, includesAuditions: false });
    const listener = { received: vi.fn(), lost: vi.fn() };
    const capture = new TakeCapture(recorder, { soundingRecipe: () => RECIPE }, listener);
    capture.sent({ type: "receipts", isOn: true });
    capture.sent({ type: "stop" });
    const arm = receipt("receipts", 1_000);
    capture.received(arm);
    capture.received(receipt("play", 1_100));
    expect(listener.received.mock.calls).toEqual([
      ["recorded", arm],
      ["mismatch", receipt("play", 1_100)],
    ]);
    capture.lost();
    expect(listener.lost).toHaveBeenCalledOnce();
  });
});
