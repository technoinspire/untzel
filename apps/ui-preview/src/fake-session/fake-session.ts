// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A stand-in for @untzel/session so the screens can be built and checked before the
// engine lands. It keeps a clock, plays the fixture's tracks as light cues and
// sounding ranges, and answers every intent. The integrator replaces it with an
// adapter over the real Session; nothing in controls, editor or visual changes.
// This file only composes: one state (fake-state.ts), its view (fake-view.ts), one
// module per family of intents, and the clock (fake-light.ts).

import type { ControlsPort } from "@untzel/skin-contract";
import type { CodePort } from "@untzel/editor";
import type { StageMode } from "@untzel/light";
import type { UntzelView } from "@untzel/presentation/view-model";
import { FakeExport } from "./intents/fake-export";
import { FakeShare } from "./intents/fake-share";
import { fakeCodePort, fakeHistory } from "./intents/fake-code";
import { FakeLight, type PreviewLightBatch } from "./fake-light";
import { fakeLibrary } from "./intents/fake-library";
import { fakePageIntents } from "./intents/fake-page-intents";
import { fakePlayback } from "./intents/fake-playback";
import { fakeRange } from "./intents/fake-range";
import { fakeSheetIntents } from "./intents/fake-sheets";
import { fakeSilentIntents } from "./intents/fake-silent-intents";
import { fakeSong } from "./intents/fake-song";
import { FakeState, type FakeOptions, type Listener } from "./fake-state";
import { fakeTracks } from "./intents/fake-tracks";
import { fakeView } from "./fake-view";

export type { FakeOptions } from "./fake-state";
export type { PreviewLightBatch } from "./fake-light";

const TICK_MS = 50;

/** What the preview's page reads beside the controls' port: the light, the clock, the editor. */
export interface PreviewHooks {
  onCues(listener: Listener<PreviewLightBatch>): () => void;
  onStageMode(listener: Listener<StageMode>): () => void;
  /** The heard clock the stage compares cues with; frozen with ?still=1, so the light is one fixed frame. */
  now(): number;
  codePort(): CodePort;
  destroy(): void;
}

export type FakeSession = ControlsPort & PreviewHooks;

export function createFakeSession(options: FakeOptions): FakeSession {
  const state = new FakeState(options, () => view());
  const announce = (message: string): void => state.announce(message);
  const emit = (): void => state.emit();
  const exporter = new FakeExport({ progress: options.exportProgress, status: options.exportStatus, still: options.still, isSong: () => state.mode === "song", announce, emit });
  const share = new FakeShare({ link: options.shareLink ?? "ready", announce, emit });
  const view = (): UntzelView => fakeView(state, { share: () => share.view(), exporter: () => exporter.view() });
  const light = new FakeLight(state, view, exporter);
  const timer = window.setInterval(() => light.tick(), TICK_MS);
  return {
    ...fakePageIntents(state),
    ...fakeHistory(state),
    ...fakePlayback(state),
    ...fakeTracks(state),
    ...fakeLibrary(state),
    ...fakeSilentIntents(state),
    ...fakeSong(state),
    ...fakeRange(state),
    ...fakeSheetIntents(exporter, share),
    view,
    subscribe: (listener) => {
      state.viewListeners.add(listener);
      return () => state.viewListeners.delete(listener);
    },
    onAnnouncement: (listener) => {
      state.announcementListeners.add(listener);
      return () => state.announcementListeners.delete(listener);
    },
    onCues: (listener) => light.onCues(listener),
    onStageMode: (listener) => {
      state.modeListeners.add(listener);
      listener(state.stageMode());
      return () => state.modeListeners.delete(listener);
    },
    now: () => state.now(),
    codePort: () => fakeCodePort(state),
    destroy: () => window.clearInterval(timer),
  };
}
