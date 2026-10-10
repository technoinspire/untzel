// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { StepView, TrackView, TransportView, UntzelView } from "@untzel/presentation/view-model";
import { NO_PROJECT } from "@untzel/presentation/view-model";

// A small view model for the presentation tests of the views: the onboard song, one
// 4-bar kick and a bass, playing bar 21 of 56 in song mode.

const hit: StepView = { kind: "hit", label: null };
const rest: StepView = { kind: "rest", label: null };

export function track(name: string, kind: TrackView["kind"], bars = 1, playingBar: number | null = null): TrackView {
  const steps = [hit, rest, rest, rest, hit, rest, rest, rest];
  return {
    name,
    instrument: name,
    group: kind === "drum" ? "drums" : "bass",
    kind,
    line: 3,
    playState: "on",
    isHinted: false,
    isMuted: false,
    isSoloed: false,
    steps,
    bars,
    patternBars: Array.from({ length: bars }, () => steps),
    playingBar,
    isScaleLocked: true,
    pitchRange: { lowest: 12, highest: 96 },
    tone: 0.5,
    hasTone: true,
    preset: "default",
    presets: [],
    sound: [],
    effects: [],
    mix: [],
    toneSetBy: [],
    patterns: [],
    currentPattern: null,
    previewing: null,
    previewingSound: null,
    content: [kind === "drum" ? "hits" : "notes"],
    noteSpan: null,
    writtenParameters: [],
  };
}

const transport: TransportView = {
  isPlaying: true, bpm: 132, key: "c minor", keyTonic: "c", keyScale: "minor", songTempo: 132, tempoSetBy: null, mode: "song", section: "drop", bar: 21, totalBars: 56,
  progress: 20.5 / 56, nextBar: 0.5, cpu: 0.3, isDropArmed: false,
  loopBars: 4, isLoopDeclared: false, loopBar: null, loopBarsSounding: null,
};

// Over 40 lines: test support, one literal of a whole UntzelView.
export function viewFixture(changes: Partial<TransportView> = {}): UntzelView {
  return {
    phase: "running",
    transport: { ...transport, ...changes },
    tracks: [track("kick", "drum", 4, 2), track("bass", "pitched")],
    song: {
      sections: [
        { name: "intro", tracks: ["kick"] },
        { name: "drop", tracks: ["kick", "bass"] },
      ],
      parts: [
        { section: "intro", bars: 8, start: 0 },
        { section: "drop", bars: 16, start: 8 },
        { section: "drop", bars: 32, start: 24 },
      ],
      currentPart: 1,
      playheadBar: 12,
    },
    playRange: {
      mode: "song",
      lastBar: 56,
      range: { startBar: 9, endBar: 24, cycle: true },
      sounding: { startBar: 9, endBar: 24, cycle: true },
      playheadBar: 13,
      parts: [
        { name: "intro", startBar: 1, endBar: 8 },
        { name: "drop", startBar: 9, endBar: 24 },
        { name: "drop", startBar: 25, endBar: 56 },
      ],
      songNames: { first: "drop", last: "drop", repeated: true, single: true },
    },
    scale: { label: "c minor", notes: ["c", "d", "eb", "f", "g", "ab", "bb"] },
    library: [],
    audition: null,
    templates: {
      catalog: {
        blank: null,
        styles: [{ id: "melodic-techno", label: "Melodic techno" }],
        projects: [{ id: "melodic-techno/midnight-bloom", style: "melodic-techno", name: "Midnight Bloom", summary: null }],
      },
      selected: "melodic-techno/midnight-bloom",
      openStyle: null,
      notice: null,
    },
    share: {
      link: { kind: "pending" },
      isLastValid: false,
      canShareLink: false,
      canShareFile: false,
      isCopied: false,
      isCopyRefused: false,
    },
    export: {
      format: "story",
      status: "idle",
      progress: null,
      secondsLeft: null,
      durations: { story: "15 s", video: "3:24", audio: "WAV" },
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
    },
    history: { canUndo: false, canRedo: false },
    starters: ["kick", "bass", "hat", "pad"],
    project: { ...NO_PROJECT, title: "Midnight Coast", saveState: "saved", fileName: "midnight-coast.untzel" },
  };
}
