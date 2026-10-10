// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { App, StartOutcome } from "../../boot";
import type { RunningControls } from "../../adapters/session-controls-port";
import type { AudioGesture } from "./audio-gesture";
import type { DeferredControlsPort } from "../deferred-controls-port";
import type { LightRelay } from "../light-relay";
import { createStartFlow, startLanding } from "./start-flow";

const WORDS = { playing: "Playing", blocked: "Tap again to allow sound", starting: "Starting" };
const CONTROLS = {} as RunningControls;

describe("startLanding", () => {
  it.each([
    [{ kind: "running", controls: CONTROLS, notice: null }, { forgetsContext: false, phase: "running", announcement: "Playing", isDark: false }],
    [{ kind: "running", controls: CONTROLS, notice: "The link could not play" }, { forgetsContext: false, phase: "running", announcement: "The link could not play", isDark: false }],
    [{ kind: "blocked" }, { forgetsContext: false, phase: "idle", announcement: "Tap again to allow sound", isDark: false }],
    [{ kind: "unsupported" }, { forgetsContext: false, phase: "unsupported", announcement: null, isDark: true }],
    [{ kind: "load-failed" }, { forgetsContext: true, phase: "load-failed", announcement: null, isDark: true }],
  ] as const)("%o lands on %o", (outcome, landing) => {
    expect(startLanding(outcome as StartOutcome, WORDS)).toEqual(landing);
  });
});

describe("createStartFlow", () => {
  function setup(context: AudioContext | null, started: () => Promise<StartOutcome>) {
    const steps: string[] = [];
    const gesture = { tap: () => (steps.push("tap"), context), forget: () => void steps.push("forget") } as unknown as AudioGesture;
    const light = { setMode: (mode: string) => void steps.push(`light ${mode}`) } as unknown as LightRelay;
    const port = {
      attach: () => void steps.push("attach"),
      setPhase: (phase: string) => void steps.push(`phase ${phase}`),
      announce: (message: string) => void steps.push(`say ${message}`),
    } as unknown as DeferredControlsPort;
    const app = { start: () => (steps.push("engine start"), started()) } as unknown as App;
    const start = createStartFlow({ gesture, light, workletUrl: "processor.js", words: WORDS, port: () => port, app: () => Promise.resolve(app) });
    return { start, steps };
  }
  const context = { audioWorklet: { addModule: () => Promise.resolve() } } as unknown as AudioContext;
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  it("unlocks first, says it is starting, then lands on the outcome", async () => {
    const { start, steps } = setup(context, () => Promise.resolve({ kind: "running", controls: CONTROLS, notice: null }));
    start({ kind: "template", name: "onboard" });
    expect(steps).toEqual(["tap", "phase loading", "say Starting"]);
    await settle();
    expect(steps).toEqual(["tap", "phase loading", "say Starting", "engine start", "attach", "phase running", "say Playing"]);
  });

  it("without Web Audio, goes dark at once and never asks the engine", () => {
    const { start, steps } = setup(null, () => Promise.resolve({ kind: "blocked" }));
    start({ kind: "template", name: "onboard" });
    expect(steps).toEqual(["tap", "phase unsupported", "light off"]);
  });

  it("a start that throws forgets the context and lands on load-failed", async () => {
    const { start, steps } = setup(context, () => Promise.reject(new Error("no engine")));
    const quiet = console.error;
    console.error = () => undefined;
    start({ kind: "template", name: "onboard" });
    await settle();
    console.error = quiet;
    expect(steps.slice(3)).toEqual(["engine start", "forget", "phase load-failed", "light off"]);
  });
});
