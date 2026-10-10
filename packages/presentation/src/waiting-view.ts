// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The view model before the engine runs: the waiting stage and its states. It is in
// the initial JS, so it reaches only the view model at run time.
import type { AppPhase, ExportView, ReceivedNotice, ShareView, TemplateCatalogView, UntzelView } from "./view-model";
import { NO_PROJECT } from "./view-model";

export interface IdleState {
  readonly phase: AppPhase;
  readonly catalog: TemplateCatalogView;
  readonly selected: string;
  readonly openStyle: string | null;
  readonly notice: ReceivedNotice | null;
}

export const IDLE_SHARE: ShareView = {
  link: { kind: "pending" },
  isLastValid: false,
  canShareLink: false,
  canShareFile: false,
  isCopied: false,
  isCopyRefused: false,
};

export const IDLE_EXPORT: ExportView = {
  format: "story",
  status: "idle",
  progress: null,
  secondsLeft: null,
  durations: { story: "–", video: "–", audio: "– · WAV" },
  origin: "",
  rangeMode: "loop",
  stretch: null,
  isPlayRangeChosen: false,
  canChooseSong: false,
  isSoloHeld: false,
  parts: [],
  range: { bars: 16 },
  quality: "hd",
  qualities: [],
  qualityNote: null,
  preview: null,
  previewStill: null,
  result: null,
  message: null,
  isVideoUnavailable: false,
};

/** What the screens show before the engine runs: the waiting stage and its states. */
// Over 40 lines: one literal of the waiting UntzelView, a field per line.
export function idleView(state: IdleState): UntzelView {
  return {
    phase: state.phase,
    transport: {
      isPlaying: false,
      bpm: 132,
      key: "c minor",
      keyTonic: "c",
      keyScale: "minor",
      songTempo: 132,
      tempoSetBy: null,
      mode: "loop",
      section: null,
      bar: null,
      totalBars: null,
      loopBars: 4,
      isLoopDeclared: false,
      loopBar: null,
      loopBarsSounding: null,
      progress: 0,
      nextBar: 0,
      cpu: null,
      isDropArmed: false,
    },
    tracks: [],
    song: { sections: [], parts: [], currentPart: null, playheadBar: null },
    playRange: { mode: "loop", lastBar: 4, range: null, sounding: null, playheadBar: null, parts: [], songNames: null },
    scale: { label: "c minor", notes: [] },
    library: [],
    audition: null,
    templates: {
      catalog: state.catalog,
      selected: state.selected,
      openStyle: state.openStyle,
      notice: state.notice,
    },
    share: IDLE_SHARE,
    export: IDLE_EXPORT,
    history: { canUndo: false, canRedo: false },
    starters: [],
    project: NO_PROJECT,
  };
}
