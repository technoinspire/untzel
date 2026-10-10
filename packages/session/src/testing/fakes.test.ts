// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { FakeDiagnosticsLog, FakeSoundPort } from "./index";

describe("session test doubles", () => {
  it("FakeSoundPort records calls and stops notifying after unsubscribe", () => {
    const sound = new FakeSoundPort();
    let ended = 0;
    const unsubscribe = sound.onEnded(() => {
      ended += 1;
    });
    sound.play("loop");
    sound.emitEnded();
    unsubscribe();
    sound.emitEnded();
    expect(sound.calls).toEqual([{ kind: "play", mode: "loop" }]);
    expect(ended).toBe(1);
  });

  it("FakeDiagnosticsLog keeps the source and the error", () => {
    const log = new FakeDiagnosticsLog();
    const error = new Error("boom");
    log.internalError("kick x...", error);
    expect(log.errors).toEqual([{ source: "kick x...", error }]);
  });
});
