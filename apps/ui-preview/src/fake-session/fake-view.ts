// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The UntzelView of the fake state: what every screen draws, at the fake clock's position
// (frozen with ?still=1 at the wireframe's values).

import type { ExportView, ShareView, TrackPlayState, TrackView, TransportView, UntzelView } from "@untzel/presentation/view-model";
import { FAKE_TEMPLATES } from "./fake-templates";
import type { Fixture } from "./fixtures";
import type { FakeState, TrackState } from "./fake-state";

/** The preview's library, most recent first. */
const FAKE_PROJECTS = [
  { id: "p1", title: "Midnight Coast", edited: "Edited 3 min ago", detail: "124 BPM · 6 tracks" },
  { id: "p2", title: "Night Drive", edited: "Edited 2 h ago", detail: "122 BPM · 5 tracks" },
  { id: "p3", title: "Remix of Harbour Lights", edited: "Edited on Oct 1", detail: "128 BPM · 7 tracks" },
  { id: "p4", title: "Untitled", edited: "Edited on Sep 28", detail: "132 BPM · 2 tracks" },
] as const;
const STILL_SONG_BAR = 20.4;
export const STILL_FRACTION = 0.62;

/** The export and share sheets' own views, read where the view lists them. */
export interface FakeSheets {
  readonly share: () => ShareView;
  readonly exporter: () => ExportView;
}

interface Position {
  readonly bar: number;
  readonly songBar: number;
  readonly phrase: number;
}

function position(state: FakeState, songBars: number): Position {
  if (state.still) return { bar: 4 * STILL_FRACTION, songBar: STILL_SONG_BAR, phrase: STILL_FRACTION };
  const bar = state.now() / state.barSeconds();
  return { bar, songBar: (bar + 20) % songBars, phrase: (bar % 4) / 4 };
}

function partAt(parts: Fixture["parts"], songBar: number): number | null {
  let start = 0;
  for (const [index, part] of parts.entries()) {
    if (songBar < start + part.bars) return index;
    start += part.bars;
  }
  return null;
}

export function playState(state: FakeState, track: TrackState, section: string | null): TrackPlayState {
  if (state.mode === "song") {
    const member = state.sections.find((entry) => entry.name === section)?.tracks.includes(track.name) ?? false;
    if (track.isMuted) return "off";
    return member ? "on" : "not-in-section";
  }
  if (track.isQueued) return "queued";
  return track.isOn && !track.isMuted ? "on" : "off";
}

export function isAudible(state: FakeState, track: TrackState, section: string | null): boolean {
  if (state.solo !== null) return state.solo === track.name;
  return playState(state, track, section) === "on";
}

interface Moment {
  readonly position: Position;
  readonly songBars: number;
  readonly part: number | null;
  readonly loopBar: number;
  readonly section: string | null;
}

function transportView(state: FakeState, { position, songBars, loopBar, section }: Moment): TransportView {
  const { fixture, mode, isPlaying, loopBars } = state;
  return {
    isPlaying,
    bpm: fixture.bpm,
    key: fixture.key,
    keyTonic: fixture.key.split(" ")[0] ?? "c",
    keyScale: "minor",
    songTempo: fixture.bpm,
    tempoSetBy: null,
    mode,
    section,
    bar: mode === "song" ? Math.floor(position.songBar) + 1 : Math.floor(position.bar) + 1,
    totalBars: mode === "song" ? songBars : null,
    loopBars,
    isLoopDeclared: true,
    loopBar: isPlaying && mode === "loop" ? loopBar + 1 : null,
    loopBarsSounding: isPlaying && mode === "loop" ? loopBars : null,
    progress: mode === "song" ? position.songBar / songBars : (loopBar + (position.bar % 1)) / loopBars,
    nextBar: position.bar % 1,
    cpu: state.still ? 0.34 : 0.32 + 0.04 * Math.sin(position.bar),
    isDropArmed: false,
  };
}

function trackView(state: FakeState, track: TrackState, section: string | null, bar: number): TrackView {
  return {
    name: track.name,
    instrument: track.instrument,
    group: track.fixture.group,
    kind: track.fixture.kind,
    line: state.indexed.find((entry) => entry.name === track.name)?.line ?? track.fixture.line,
    playState: playState(state, track, section),
    isMuted: track.isMuted,
    isSoloed: state.solo === track.name,
    isHinted: false,
    preset: "",
    presets: [],
    effects: [],
    steps: track.steps,
    bars: track.patternBars.length,
    patternBars: track.patternBars,
    playingBar: state.isPlaying ? (bar % state.loopBars) % track.patternBars.length : null,
    isScaleLocked: track.isFree !== true,
    pitchRange: { lowest: 12, highest: 96 },
    tone: track.tone,
    hasTone: true,
    sound: track.fixture.sound,
    mix: track.fixture.mix,
    toneSetBy: [],
    patterns: [],
    currentPattern: null,
    previewing: null,
    previewingSound: null,
    content: [track.fixture.kind === "drum" ? "hits" : "notes"],
    noteSpan: null,
    writtenParameters: [],
  };
}

function songAndRange(state: FakeState, { position, songBars, part, loopBar }: Moment): Pick<UntzelView, "song" | "playRange"> {
  const { mode, parts } = state;
  return {
    song: { sections: state.sections, parts, currentPart: mode === "song" ? part : null, playheadBar: mode === "song" ? position.songBar : null },
    playRange: {
      mode,
      lastBar: mode === "song" ? songBars : state.loopBars,
      range: state.ranges[mode],
      sounding: state.ranges[mode],
      playheadBar: !state.isPlaying ? null : mode === "song" ? Math.floor(position.songBar) + 1 : loopBar + 1,
      parts: mode === "song" ? parts.map((entry) => ({ name: entry.section, startBar: entry.start + 1, endBar: entry.start + entry.bars })) : [],
      songNames: null,
    },
  };
}

function projectView(state: FakeState): UntzelView["project"] {
  const isRunning = state.phase === "running";
  return {
    title: isRunning ? state.title : null,
    saveState: isRunning ? "saved" : null,
    fileName: "midnight-coast.untzel",
    isStorageBlocked: false,
    projects: FAKE_PROJECTS.map((project) => ({ ...project, isOpen: isRunning && project.id === "p1" })),
    latest: { id: "p1", title: state.title },
  };
}

export function fakeView(state: FakeState, sheets: FakeSheets): UntzelView {
  const songBars = state.parts.reduce((sum, part) => sum + part.bars, 0);
  const at = position(state, songBars);
  const part = state.mode === "song" ? partAt(state.parts, at.songBar) : null;
  const section = part === null ? null : (state.parts[part]?.section ?? null);
  const moment: Moment = { position: at, songBars, part, loopBar: Math.floor(at.bar) % state.loopBars, section };
  return {
    phase: state.phase,
    transport: transportView(state, moment),
    tracks: state.tracks.map((track) => trackView(state, track, section, Math.floor(at.bar))),
    ...songAndRange(state, moment),
    scale: { label: state.fixture.key, notes: state.fixture.scale },
    library: state.fixture.library.map((entry) => ({ ...entry, inSong: state.tracks.filter((track) => track.instrument === entry.instrument).length })),
    audition: null,
    templates: { catalog: FAKE_TEMPLATES, selected: state.template, openStyle: state.templateStyle, notice: state.notice },
    share: sheets.share(),
    export: sheets.exporter(),
    history: { canUndo: state.history.length > 0, canRedo: state.future.length > 0 },
    starters: ["kick", "bass", "hat", "pad"],
    project: projectView(state),
  };
}
