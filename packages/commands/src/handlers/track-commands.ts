// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { addNamedTrack, deleteTrack, duplicateTrack, nextFreeName, readNames, renameTrack, setTrackMuted, suggest } from "@untzel/language";
import type { CommandContext } from "../reading/context";
import { nameError } from "../reading/name-errors";
import { error, type CommandOutcome } from "../proposal/outcome";
import { strings } from "../copy/copy";

// add, duplicate, remove, rename, mute, unmute and solo: the same edits the track
// controls make.

/** 1-based line of a track in a text. */
function lineOf(source: string, track: string): number {
  return readNames(source).tracks.find((entry) => entry.name === track)?.line ?? 1;
}

export function add(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(2);
  if (!limit.ok) return limit.outcome;
  const word = context.argument(0, strings.addNeedsInstrument);
  if (!word.ok) return word.outcome;
  const instrument = word.value.text;
  const manifest = context.vocabulary.manifest(instrument);
  if (manifest === undefined) {
    const near = suggest(instrument, context.vocabulary.instruments());
    return error(strings.unknownInstrument(instrument), near === null ? null : context.suggestLine(word.value, near));
  }
  const taken = new Set(context.names.tracks.map((track) => track.name));
  const wanted = context.args[1]?.text ?? null;
  const problem = wanted === null ? null : nameError(wanted, taken);
  if (problem !== null) return problem;
  // One inserted line, one undo step: the new line already carries the chosen name.
  const added = addNamedTrack(context.source, manifest, wanted ?? nextFreeName(manifest.name, taken));
  const summary = added.ok ? strings.added(added.name, lineOf(added.source, added.name)) : "";
  return context.propose(added, { title: context.line, summary, destructive: false });
}

/** The detail's Duplicate: the line under the next free name, in the loop section too. */
export function duplicate(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(1);
  if (!limit.ok) return limit.outcome;
  const track = context.track(0);
  if (!track.ok) return track.outcome;
  const copied = duplicateTrack(context.source, track.value);
  const summary = copied.ok ? strings.duplicated(track.value, copied.name, lineOf(copied.source, copied.name)) : "";
  return context.propose(copied, { title: context.line, summary, destructive: false });
}

export function remove(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(1);
  if (!limit.ok) return limit.outcome;
  const track = context.track(0);
  if (!track.ok) return track.outcome;
  return context.propose(deleteTrack(context.source, track.value), {
    title: context.line,
    summary: strings.removed(track.value),
    destructive: true,
  });
}

export function rename(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(2);
  if (!limit.ok) return limit.outcome;
  const track = context.track(0);
  if (!track.ok) return track.outcome;
  const word = context.argument(1, strings.renameNeedsName);
  if (!word.ok) return word.outcome;
  const wanted = word.value.text;
  const others = new Set(context.names.tracks.map((entry) => entry.name).filter((name) => name !== track.value));
  const problem = nameError(wanted, others);
  if (problem !== null) return problem;
  return context.propose(renameTrack(context.source, track.value, wanted), {
    title: context.line,
    summary: strings.renamed(track.value, wanted),
    destructive: false,
  });
}

export function mute(context: CommandContext, muted: boolean): CommandOutcome {
  const limit = context.noMoreThan(1);
  if (!limit.ok) return limit.outcome;
  const track = context.track(0);
  if (!track.ok) return track.outcome;
  return context.propose(setTrackMuted(context.source, track.value, muted), {
    title: context.line,
    summary: muted ? strings.muted(track.value) : strings.unmuted(track.value),
    destructive: false,
  });
}

/** Solo never goes to the text: the session holds it. */
export function solo(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(1);
  if (!limit.ok) return limit.outcome;
  const track = context.track(0);
  if (!track.ok) return track.outcome;
  return { kind: "action", action: { kind: "solo", track: track.value } };
}
