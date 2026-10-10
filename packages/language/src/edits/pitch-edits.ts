// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { StepPitch } from "@untzel/core";
import { EditableSource } from "./document";
import { applyChanges, failure, type EditResult } from "./text-changes";
import { atomAtStep } from "./track-edits";

// The note picker's edit: one step of a melodic track becomes
// a note in any octave, a chord of any quality, a hold that lengthens the note before it,
// or a rest. One change, at that step only; the rest of the line stays as written.

/** A note word of the grammar: letter, optional accidental, one-digit octave (c2, eb4). */
const NOTE_RULE = /^[a-g][b#]?\d$/;
/** A chord root of the grammar: capital letter, optional accidental (F, Bb, C#). */
const ROOT_RULE = /^[A-G][b#]?$/;
/** Hits characters a hits word can take in place, without splitting it. */
const HITS_CHARACTERS = new Set([".", "x", "X"]);

/** The text of a pitch as the grammar writes it; null when it is not valid. */
export function pitchText(pitch: StepPitch): string | null {
  switch (pitch.kind) {
    case "note":
      return NOTE_RULE.test(pitch.note) ? pitch.note : null;
    case "chord":
      return ROOT_RULE.test(pitch.root) ? `${pitch.root}${pitch.quality === "major" ? "" : pitch.quality}` : null;
    case "hold":
      return "~";
    case "rest":
      return ".";
  }
}

/**
 * Puts `pitch` on a step, in one change. A note, chord, hold or lone hit is replaced,
 * keeping its suffix ("c2?" stays a maybe). Inside a hits word a rest or a hit takes the
 * character's place; anything else splits the word around the step ("x.x." with step 1
 * and "c2" gives "x c2 x."), so the bar keeps its number of steps.
 */
export function setStepPitch(source: string, track: string, bar: number, step: number, pitch: StepPitch): EditResult {
  const text = pitchText(pitch);
  if (text === null) return failure("INVALID_VALUE");
  const found = new EditableSource(source).track(track);
  if (found === null) return failure("UNKNOWN_TRACK");
  const barNode = found.syntax.pattern?.getChildren("Bar")[bar];
  const target = barNode === undefined ? null : atomAtStep(barNode, step);
  if (target === null || target.atom.name === "Group") return failure("UNKNOWN_STEP");
  const { atom, offset } = target;
  const isWord = atom.name === "Hits" && atom.to - atom.from > 1;
  if (!isWord) return applyChanges(source, [{ from: atom.from, to: atom.to, insert: text }]);
  const at = atom.from + offset;
  // "~" may continue a hits word ("x~~~") but never start one.
  const fitsInWord = HITS_CHARACTERS.has(text) || (text === "~" && at > atom.from);
  if (fitsInWord) return applyChanges(source, [{ from: at, to: at + 1, insert: text }]);
  const before = at > atom.from ? " " : "";
  const after = at + 1 < atom.to ? " " : "";
  return applyChanges(source, [{ from: at, to: at + 1, insert: `${before}${text}${after}` }]);
}
