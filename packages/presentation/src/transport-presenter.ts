// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The transport and the range ruler of the view model: tempo, key, mode, the bar sounding
// in the song or the loop, and the play range on the ruler. Pure.
import { pitchClassName } from "@untzel/core";
import type { PlaybackPosition, PlayRangeView, SessionView } from "@untzel/session";
import { captionSection } from "./loop-section-view";
import { keyLabel } from "./music-names";
import { DEFAULT_BPM, wrap, type Now } from "./playback-now";
import { rulerBarNow } from "./ruler-position";
import type { PlayRangeView as ControlPlayRangeView, TransportView } from "./view-model";
const DEFAULT_LOOP_BARS = 4;
/** What the transport says whether or not it plays. */
type TransportBase = Omit<TransportView, "section" | "bar" | "progress" | "nextBar" | "loopBar" | "loopBarsSounding">;
export function transportView(view: SessionView, now: Now | null, ranges: PlayRangeView): TransportView {
  const bpm = view.tempo ?? DEFAULT_BPM;
  const mode = view.mode ?? "loop";
  const totalBars = mode === "song" ? (view.song?.totalBars ?? null) : null;
  const base = {
    isPlaying: view.playing,
    bpm,
    key: keyLabel(view.key),
    keyTonic: pitchClassName(view.key?.tonic ?? 0),
    keyScale: view.key?.scale ?? "minor",
    songTempo: view.songTempo ?? bpm,
    tempoSetBy: tempoSetBy(view),
    mode,
    cpu: view.load.fraction,
    isDropArmed: false,
    totalBars,
    loopBars: view.loop?.bars ?? DEFAULT_LOOP_BARS,
    isLoopDeclared: view.loop?.declared ?? false,
  };
  const position = view.position;
  if (position === null || now === null) {
    return { ...base, section: captionSection(view, null), bar: null, progress: 0, nextBar: 0, loopBar: null, loopBarsSounding: null };
  }
  if (mode === "song" && totalBars !== null && totalBars > 0) return songTransport(base, view, position, now, ranges, totalBars);
  return loopTransport(base, view, position, now, ranges);
}
function songTransport(base: TransportBase, view: SessionView, position: PlaybackPosition, now: Now, ranges: PlayRangeView, totalBars: number): TransportView {
  const { bar, fraction } = now;
  // The song bar from the part and the bar in it: a play range moves the song under the
  // bars since play, so those no longer count song bars.
  const partStart = position.partIndex === null ? null : (view.song?.parts[position.partIndex]?.start ?? null);
  const reported = partStart === null || position.barInPart === null ? null : wrap(partStart + position.barInPart, totalBars);
  const inPass = reported === null ? wrap(bar, totalBars) : rulerBarNow(reported, now.elapsed, totalBars, ranges.song, ranges.song?.cycle ?? false);
  return {
    ...base,
    section: position.section,
    bar: inPass + 1,
    progress: (inPass + fraction) / totalBars,
    nextBar: fraction,
    loopBar: null,
    loopBarsSounding: null,
  };
}
/**
 * Loop mode: the loop the transport plays now ("bar 3 of 8"); a new length from the
 * text replaces it on the next bar boundary.
 */
function loopTransport(base: TransportBase, view: SessionView, position: PlaybackPosition, now: Now, ranges: PlayRangeView): TransportView {
  const { bar, fraction } = now;
  const sounding = position.loopBars ?? base.loopBars;
  const inLoop = rulerBarNow(wrap(position.loopBar ?? bar, sounding), now.elapsed, sounding, ranges.loop, true);
  return {
    ...base,
    section: captionSection(view, null),
    bar: bar + 1,
    progress: (inLoop + fraction) / sounding,
    nextBar: fraction,
    loopBar: inLoop + 1,
    loopBarsSounding: sounding,
  };
}
/**
 * The range ruler: the ruler of the mode asked for, its range, the bar sounding on
 * it (only when that mode sounds), and the song's parts as 1-based bars.
 */
export function playRangeView(view: SessionView, ranges: PlayRangeView, transport: TransportView): ControlPlayRangeView {
  const parts = (view.song?.parts ?? []).map((part) => ({ name: part.section, startBar: part.start + 1, endBar: part.start + part.bars }));
  const sounds = view.playing && transport.mode === ranges.mode;
  const playheadBar = !sounds ? null : transport.mode === "loop" ? transport.loopBar : transport.bar;
  return {
    mode: ranges.mode,
    lastBar: ranges.lastBar ?? 0,
    range: ranges.range,
    sounding: transport.mode === "loop" ? ranges.loop : ranges.song,
    playheadBar,
    parts: ranges.mode === "song" ? parts : [],
    songNames: ranges.songNames,
  };
}
/** The part that plays at its own `| tempo` in song mode. */
function tempoSetBy(view: SessionView): string | null {
  const part = view.song?.currentPart ?? null;
  const name = part === null ? null : (view.song?.parts[part]?.section ?? null);
  const section = view.sections.find((entry) => entry.name === name);
  return section?.tempo === null || section?.tempo === undefined || view.mode !== "song" ? null : section.name;
}
