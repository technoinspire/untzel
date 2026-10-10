// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentManifest, InstrumentRegistry, Key, Track } from "@untzel/core";
import {
  addTrack,
  analyze,
  dropEdit,
  renameTrack,
  setLoopBars,
  setSectionMembership,
  setStepCount,
  setStepPitch,
  setTrackBars,
  setTrackMuted,
  setTrackParameter,
  toggleStep,
  type EditResult,
} from "@untzel/language";
import type { CodePlacement, DemoAction } from "../actions";

// Replays demo actions on a text through the language's minimal edits: the same edits
// the session applies for each intent. Typed code is inserted where the Code panel
// cursor would be. Transport actions leave the text as it is.

export type ReplayResult =
  | { readonly ok: true; readonly source: string }
  | { readonly ok: false; readonly reason: string };

function fromEdit(result: EditResult): ReplayResult {
  return result.ok ? { ok: true, source: result.source } : { ok: false, reason: result.reason };
}

function findTrack(source: string, name: string, registry: InstrumentRegistry): Track | string {
  const analysis = analyze(source, registry);
  if (!analysis.ok) return "INVALID_SOURCE";
  return analysis.program.tracks.find((track) => track.name === name) ?? "UNKNOWN_TRACK";
}

/** End of the track statement: before a trailing comment and its spaces. */
function statementEnd(source: string, track: Track): number {
  const line = source.slice(track.source.from, track.source.to);
  const comment = line.indexOf("//");
  return track.source.from + (comment < 0 ? line : line.slice(0, comment)).trimEnd().length;
}

/** Where typed code goes in `source`: the range it replaces, and a line break typed first. */
export interface CodeTarget {
  readonly from: number;
  readonly to: number;
  /** "\n" when a new line has to be started at the end; "" otherwise. */
  readonly lineBreak: string;
}
/** The range a placement names in the text as it is now, as the Code panel's cursor finds it. */
export function codeTarget(source: string, placement: CodePlacement, registry: InstrumentRegistry): CodeTarget | string {
  if (placement.kind === "appendLine") {
    return { from: source.length, to: source.length, lineBreak: source === "" || source.endsWith("\n") ? "" : "\n" };
  }
  const track = findTrack(source, placement.track, registry);
  if (typeof track === "string") return track;
  if (placement.kind === "trackEnd") {
    const end = statementEnd(source, track);
    return { from: end, to: end, lineBreak: "" };
  }
  const first = track.pattern.bars[0];
  const last = track.pattern.bars.at(-1);
  if (first === undefined || last === undefined) return "UNKNOWN_STEP";
  return { from: first.source.from, to: last.source.to, lineBreak: "" };
}
function typeCode(source: string, placement: CodePlacement, text: string, registry: InstrumentRegistry): ReplayResult {
  const target = codeTarget(source, placement, registry);
  if (typeof target === "string") return { ok: false, reason: target };
  return { ok: true, source: source.slice(0, target.from) + target.lineBreak + text + source.slice(target.to) };
}
/** The music's key: the session adds a track with its pattern already in it (patternInKey). */
function keyOf(source: string, registry: InstrumentRegistry): Key | null {
  const analysis = analyze(source, registry);
  return analysis.ok ? analysis.program.key : null;
}
/** The Add track sheet's edit: the instrument, its sound, the first pattern in the music's key. */
export function addTrackAsTheSession(source: string, manifest: InstrumentManifest, preset: string | null, registry: InstrumentRegistry): ReturnType<typeof addTrack> {
  return addTrack(source, manifest, preset, null, keyOf(source, registry));
}
function replayAddTrack(source: string, action: Extract<DemoAction, { kind: "addTrack" }>, registry: InstrumentRegistry): ReplayResult {
  const manifest = registry.get(action.instrument);
  if (manifest === undefined) return { ok: false, reason: "UNKNOWN_INSTRUMENT" };
  const result = addTrackAsTheSession(source, manifest, action.preset, registry);
  if (!result.ok) return { ok: false, reason: result.reason };
  return result.name === action.track ? { ok: true, source: result.source } : { ok: false, reason: "NAME_MISMATCH" };
}

/** Applies one action to `source`. */
export function replayAction(source: string, action: DemoAction, registry: InstrumentRegistry): ReplayResult {
  switch (action.kind) {
    case "addTrack":
      return replayAddTrack(source, action, registry);
    case "renameTrack":
      return fromEdit(renameTrack(source, action.track, action.newName));
    case "setStepCount":
      return fromEdit(setStepCount(source, action.track, action.count, action.hold));
    case "setTrackBars":
      return fromEdit(setTrackBars(source, action.track, action.bars));
    case "toggleStep":
      return fromEdit(toggleStep(source, action.track, action.bar, action.step));
    case "setStepNote":
      return fromEdit(setStepPitch(source, action.track, action.bar, action.step, { kind: "note", note: action.note }));
    case "setParameter":
      return fromEdit(setTrackParameter(source, action.track, action.parameter, action.value));
    case "setMute":
      return fromEdit(setTrackMuted(source, action.track, action.muted));
    case "setLoopBars":
      return fromEdit(setLoopBars(source, action.bars));
    case "addSectionMember":
      return fromEdit(setSectionMembership(source, action.section, action.track, true));
    case "typeCode":
      return typeCode(source, action.placement, action.text, registry);
    case "drop":
      return fromEdit(dropEdit(source));
    case "togglePlay":
    case "setMode":
      return { ok: true, source };
  }
}

/** Applies every action in order; stops at the first one that fails, with its index. */
export function replayActions(
  source: string,
  actions: readonly DemoAction[],
  registry: InstrumentRegistry,
): ReplayResult & { readonly failedAt?: number } {
  let current = source;
  for (const [index, action] of actions.entries()) {
    const result = replayAction(current, action, registry);
    if (!result.ok) return { ...result, failedAt: index };
    current = result.source;
  }
  return { ok: true, source: current };
}
