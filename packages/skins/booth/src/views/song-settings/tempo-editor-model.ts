// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The tempo editor of the transport: its title, its field, the link
// line when a part plays at its own `| tempo`, and what typing or tapping writes. Pure.

import { strings } from "../../copy/copy";
export const MIN_BPM = 40;
export const MAX_BPM = 300;
/** Tap tempo starts over after a pause this long. */
export const TAP_RESET_MS = 2_000;
/** Taps averaged: the last three intervals, from the fourth tap on. */
const TAP_INTERVALS = 3;

export interface TempoInput {
  /** What sounds: the part's tempo in song mode, else the song's. */
  readonly sounding: number;
  /** The global `tempo` line: what the editor writes. */
  readonly songTempo: number;
  /** The part playing at its own `| tempo`; null when the song tempo sounds. */
  readonly setBy: string | null;
}

export interface TempoEditorModel {
  readonly title: string;
  readonly field: string;
  /** "drop plays at 128, set in its section line. Change it in the Code panel." */
  readonly link: string | null;
  /** The transport button's accessible name. */
  readonly buttonLabel: string;
  readonly note: string;
}

/** 124 → "124", 132.5 → "132.5". */
export function bpmText(bpm: number): string {
  return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}

export function tempoEditorModel(input: TempoInput): TempoEditorModel {
  const song = bpmText(input.songTempo);
  const sounding = bpmText(input.sounding);
  if (input.setBy === null) {
    return { title: strings.tempo, field: song, link: null, buttonLabel: strings.tempoButton(sounding), note: strings.tempoNow(song) };
  }
  return {
    title: strings.songTempo,
    field: song,
    link: strings.tempoSetByPart(input.setBy, sounding),
    buttonLabel: strings.tempoButtonInPart(sounding, song),
    note: strings.songTempoNow(song),
  };
}

export type TempoEntry = { readonly kind: "ok"; readonly bpm: number } | { readonly kind: "error"; readonly message: string } | { readonly kind: "unchanged" };

/** What the field writes: a number from 40 to 300 with at most one decimal (a comma counts as a point). */
export function parseTempo(text: string, current: number): TempoEntry {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return { kind: "unchanged" };
  const error = { kind: "error", message: strings.tempoRange(MIN_BPM, MAX_BPM, bpmText(current)) } as const;
  if (!/^\d{1,3}(\.\d)?$/.test(trimmed)) return error;
  const bpm = Number(trimmed);
  if (bpm < MIN_BPM || bpm > MAX_BPM) return error;
  return bpm === current ? { kind: "unchanged" } : { kind: "ok", bpm };
}

/** −, + and the arrows: 1 BPM, Shift 10, kept inside 40..300 and rounded to a whole BPM. */
/** The BPM field's arrows: 1 BPM, 10 with Shift; null for any other key. */
export function fieldKeySteps(key: string, isShift: boolean): number | null {
  if (key !== "ArrowUp" && key !== "ArrowDown") return null;
  return (key === "ArrowUp" ? 1 : -1) * (isShift ? 10 : 1);
}

export function steppedTempo(current: number, steps: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(current) + steps));
}

/** The taps kept and, from the fourth, the tempo they give (whole BPM). */
export interface TapState {
  readonly taps: readonly number[];
  readonly bpm: number | null;
}

export function tapTempo(state: TapState, at: number): TapState {
  const last = state.taps.at(-1);
  const taps = [...(last !== undefined && at - last > TAP_RESET_MS ? [] : state.taps), at].slice(-(TAP_INTERVALS + 1));
  if (taps.length <= TAP_INTERVALS) return { taps, bpm: null };
  const first = taps[0] ?? at;
  const average = (at - first) / TAP_INTERVALS;
  return { taps, bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(60_000 / average))) };
}
