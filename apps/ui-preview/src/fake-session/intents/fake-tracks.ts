// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The track intents of the fake session: on and off, solo and mute, steps and bars, the
// sliders, duplicate and delete. Mixing and renaming are exercised by the real app's
// browser tests; the preview says what would happen.

import type { BarIntents, MixIntents, RenameIntents, SessionIntents, TrackIntents } from "@untzel/skin-contract";
import type { StepPitch } from "@untzel/core";
import type { StepView } from "@untzel/presentation/view-model";
import type { TrackFixture } from "../fixtures";
import { trackStateOf, type FakeState } from "../fake-state";

/** What a picked pitch looks like in the grid. */
function stepOfPitch(pitch: StepPitch): StepView {
  switch (pitch.kind) {
    case "note":
      return { kind: "note", label: pitch.note };
    case "chord":
      return { kind: "chord", label: `${pitch.root}${pitch.quality === "major" ? "" : pitch.quality}` };
    case "hold":
      return { kind: "hold", label: null };
    case "rest":
      return { kind: "rest", label: null };
  }
}

function toggleTrack(state: FakeState, name: string): void {
  const track = state.track(name);
  if (track === undefined) return;
  if (state.still) track.isOn = !track.isOn;
  else track.isQueued = !track.isQueued;
  state.announce(`${name} ${track.isOn !== track.isQueued ? "on" : "off"} on the next bar.`);
  state.emit();
}

function setSolo(state: FakeState, name: string, isSoloed: boolean): void {
  state.solo = isSoloed ? name : state.solo === name ? null : state.solo;
  state.emit();
}

function setMute(state: FakeState, name: string, isMuted: boolean): void {
  const track = state.track(name);
  if (track === undefined) return;
  track.isMuted = isMuted;
  state.noteChange(track, "mute", isMuted ? "on" : "off");
}

function setTone(state: FakeState, name: string, tone: number): void {
  const track = state.track(name);
  if (track === undefined) return;
  track.tone = tone;
  state.emit();
}

function toggleStep(state: FakeState, name: string, bar: number, step: number): void {
  const track = state.track(name);
  const cells = track?.patternBars[bar];
  const current = cells?.[step];
  if (track === undefined || cells === undefined || current === undefined) return;
  const pitched = track.fixture.kind !== "drum";
  cells[step] = current.kind === "rest"
    ? (pitched ? { kind: "note", label: `${state.fixture.scale[0] ?? "c"}2` } : { kind: "hit", label: null })
    : { kind: "rest", label: null };
  state.noteChange(track, `step ${step + 1}`, cells[step]?.label ?? cells[step]?.kind ?? "");
}

function setStepPitch(state: FakeState, name: string, bar: number, step: number, pitch: StepPitch): void {
  const track = state.track(name);
  const cells = track?.patternBars[bar];
  if (track === undefined || cells === undefined || cells[step] === undefined) return;
  cells[step] = stepOfPitch(pitch);
  state.noteChange(track, `step ${step + 1}`, cells[step]?.label ?? pitch.kind);
}

function setScaleLock(state: FakeState, name: string, isLocked: boolean): void {
  const track = state.track(name);
  if (track === undefined) return;
  track.isFree = !isLocked;
  state.noteChange(track, "scale lock", isLocked ? "on" : "off");
}

function setStepCount(state: FakeState, name: string, count: number): void {
  const track = state.track(name);
  if (track === undefined) return;
  track.patternBars = track.patternBars.map((cells) =>
    Array.from({ length: count }, (_, index) => cells[index] ?? { kind: "rest", label: null }));
  track.steps = track.patternBars[0] ?? [];
  state.noteChange(track, "steps", String(count));
}

function setBars(state: FakeState, name: string, bars: number): void {
  const track = state.track(name);
  if (track === undefined) return;
  const last = track.patternBars.at(-1) ?? track.steps;
  track.patternBars = Array.from({ length: bars }, (_, index) => track.patternBars[index] ?? [...last]);
  track.steps = track.patternBars[0] ?? [];
  state.noteChange(track, "bars", String(bars));
}

function setParameter(state: FakeState, name: string, parameter: string, fraction: number): void {
  const track = state.track(name);
  if (track === undefined) return;
  const update = (list: TrackFixture["sound"]): TrackFixture["sound"] =>
    list.map((entry) => (entry.name === parameter ? { ...entry, fraction, signal: null, display: fraction.toFixed(2) } : entry));
  track.fixture = { ...track.fixture, sound: update(track.fixture.sound), mix: update(track.fixture.mix) };
  state.noteChange(track, parameter, fraction.toFixed(2));
}

function duplicateTrack(state: FakeState, name: string): string {
  const track = state.track(name);
  if (track === undefined) return name;
  const copy = state.freeName(name.replace(/\d+$/, ""));
  const patternBars = track.patternBars.map((cells) => [...cells]);
  state.tracks.push({ ...track, ...trackStateOf({ ...track.fixture, name: copy }, patternBars), isOn: false, isQueued: true });
  state.announce(`${copy} added. It starts on the next bar.`);
  state.emit();
  return copy;
}

function deleteTrack(state: FakeState, name: string): void {
  state.tracks = state.tracks.filter((track) => track.name !== name);
  for (const section of state.sections) section.tracks = section.tracks.filter((track) => track !== name);
  state.announce(`${name} deleted.`);
  state.emit();
}

function copyBar(state: FakeState, name: string, bar: number): boolean {
  const cells = state.track(name)?.patternBars[bar];
  if (cells === undefined) return false;
  state.copiedBar = cells.map((cell) => ({ ...cell }));
  state.announce(`Bar ${bar + 1} of ${name} copied.`);
  return true;
}

function pasteBar(state: FakeState, name: string, bar: number): void {
  const track = state.track(name);
  const copied = state.copiedBar;
  if (track === undefined || copied === null || track.patternBars[bar] === undefined) return;
  track.patternBars[bar] = copied.map((cell) => ({ ...cell }));
  track.steps = track.patternBars[0] ?? [];
  state.noteChange(track, `bar ${bar + 1}`, "pasted");
}

function clearBar(state: FakeState, name: string, bar: number): void {
  const track = state.track(name);
  const cells = track?.patternBars[bar];
  if (track === undefined || cells === undefined) return;
  track.patternBars[bar] = cells.map(() => ({ kind: "rest", label: null }));
  track.steps = track.patternBars[0] ?? [];
  state.noteChange(track, `bar ${bar + 1}`, "rests");
}

type FakeTrackIntents = TrackIntents & BarIntents & MixIntents & Pick<RenameIntents, "renameTrack"> & Pick<SessionIntents, "endGesture">;

export function fakeTracks(state: FakeState): FakeTrackIntents {
  return {
    endGesture: () => undefined,
    toggleTrack: (name) => toggleTrack(state, name),
    setSolo: (name, isSoloed) => setSolo(state, name, isSoloed),
    setMute: (name, isMuted) => setMute(state, name, isMuted),
    setTone: (name, tone) => setTone(state, name, tone),
    toggleStep: (name, bar, step) => toggleStep(state, name, bar, step),
    setStepPitch: (name, bar, step, pitch) => setStepPitch(state, name, bar, step, pitch),
    setScaleLock: (name, isLocked) => setScaleLock(state, name, isLocked),
    setStepCount: (name, count) => setStepCount(state, name, count),
    setBars: (name, bars) => setBars(state, name, bars),
    setParameter: (name, parameter, fraction) => setParameter(state, name, parameter, fraction),
    duplicateTrack: (name) => duplicateTrack(state, name),
    deleteTrack: (name) => deleteTrack(state, name),
    copyBar: (name, bar) => copyBar(state, name, bar),
    pasteBar: (name, bar) => pasteBar(state, name, bar),
    clearBar: (name, bar) => clearBar(state, name, bar),
    renameTrack: (track, newName) => state.announce(`Renamed ${track} to ${newName}.`),
    useTone: () => [],
    nudgeGain: () => undefined,
    resetGain: () => undefined,
  };
}
