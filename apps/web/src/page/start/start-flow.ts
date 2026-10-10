// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The tap that starts the music: the audio unlocks inside the gesture, then the
// engine starts what the tap chose and the page lands on the phase the outcome names.
// Part of the initial JS.
import { addWorkletEarly } from "@untzel/audio/preload";
import type { AppPhase } from "@untzel/presentation/view-model";
import type { App, StartOutcome } from "../../boot";
import type { LightRelay } from "../light-relay";
import type { AudioGesture } from "./audio-gesture";
import type { DeferredControlsPort, StartSource } from "../deferred-controls-port";

/** Where the page lands after a start, in the order the page applies it. */
export interface StartLanding {
  /** The context is dropped, so the next tap makes a new one. */
  readonly forgetsContext: boolean;
  readonly phase: AppPhase;
  /** Said after the phase changes; null says nothing. */
  readonly announcement: string | null;
  /** The light stage goes dark: nothing plays here. */
  readonly isDark: boolean;
}

export interface StartWords {
  readonly playing: string;
  readonly blocked: string;
}

export function startLanding(outcome: StartOutcome, words: StartWords): StartLanding {
  switch (outcome.kind) {
    case "running":
      return { forgetsContext: false, phase: "running", announcement: outcome.notice ?? words.playing, isDark: false };
    case "blocked":
      return { forgetsContext: false, phase: "idle", announcement: words.blocked, isDark: false };
    case "unsupported":
      return { forgetsContext: false, phase: "unsupported", announcement: null, isDark: true };
    case "load-failed":
      return { forgetsContext: true, phase: "load-failed", announcement: null, isDark: true };
  }
}

export interface StartFlowOptions {
  readonly gesture: AudioGesture;
  readonly light: LightRelay;
  readonly workletUrl: string;
  /** The page's announcements, read when the outcome lands (the current language). */
  readonly words: StartWords & { readonly starting: string };
  /** Late-bound: the port is made after the flow, as the flow is one of its actions. */
  readonly port: () => DeferredControlsPort;
  readonly app: () => Promise<App>;
}

export function createStartFlow(options: StartFlowOptions): (source: StartSource) => void {
  const { gesture, light, words } = options;
  const land = (outcome: StartOutcome): void => {
    const port = options.port();
    const landing = startLanding(outcome, words);
    if (landing.forgetsContext) gesture.forget();
    if (outcome.kind === "running") port.attach(outcome.controls);
    port.setPhase(landing.phase);
    if (landing.announcement !== null) port.announce(landing.announcement);
    if (landing.isDark) light.setMode("off");
  };
  return (source) => {
    const unlocked = gesture.tap();
    if (unlocked === null) return land({ kind: "unsupported" });
    addWorkletEarly(unlocked, options.workletUrl);
    const port = options.port();
    port.setPhase("loading");
    port.announce(words.starting);
    options
      .app()
      .then((loaded) => loaded.start(unlocked, source))
      .then(land)
      .catch((error: unknown) => {
        console.error("Untzel couldn't start", error);
        land({ kind: "load-failed" });
      });
  };
}
