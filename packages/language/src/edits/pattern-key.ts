// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  midiToNoteName,
  noteNameToMidi,
  pitchClassName,
  tonicToPitchClass,
  transposeFromC,
  type InstrumentKind,
  type Key,
} from "@untzel/core";
import { parser } from "../read/parser";
import type { TextChange } from "./text-changes";
import { applyChanges } from "./text-changes";

// Manifest patterns and previews are written in c minor. The key of the text only locks
// the scale, it never transposes, so a pattern enters the text with its notes already
// rewritten in the music's key (never with `| transpose`): what is heard is what is
// written, and the person edits real notes.

/** A syntactic instrument name: only the grammar reads it, never a manifest. */
const PROBE = "p: probe ";

function chordInKey(text: string, shift: number): string | null {
  const match = /^([A-G])([b#]?)(.*)$/.exec(text);
  if (match === null) return null;
  const [, letter = "", accidental = "", quality = ""] = match;
  const root = tonicToPitchClass(`${letter.toLowerCase()}${accidental}`);
  if (root === null) return null;
  const name = pitchClassName(root + shift);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}${quality}`;
}

function noteInKey(text: string, shift: number): string | null {
  const midi = noteNameToMidi(text);
  return midi === null ? null : midiToNoteName(midi + shift);
}

/**
 * `text` (in c minor) moved to the tonic of `key` by transposeFromC, −6..+5 semitones:
 * notes (also inside a stack) get new names, chord roots too (`Cm7` → `Am7`), and the
 * rest (rests, `~`, `!`, `?`, `*n`, groups, `/`) stays byte for byte. Drums and a null key
 * are unchanged. Null when the text does not parse or a note leaves c0..g9. The scale is
 * not used: notes outside it go through the scale lock, like any written note.
 */
export function patternInKey(text: string, kind: InstrumentKind, key: Key | null): string | null {
  const shift = key === null ? 0 : transposeFromC(key.tonic);
  const tree = parser.parse(`${PROBE}${text}`);
  let isBroken = false;
  const changes: TextChange[] = [];
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) isBroken = true;
      if (kind === "drum" || shift === 0 || (node.name !== "Note" && node.name !== "Chord")) return;
      const from = node.from - PROBE.length;
      const written = text.slice(from, node.to - PROBE.length);
      const moved = node.name === "Note" ? noteInKey(written, shift) : chordInKey(written, shift);
      if (moved === null) isBroken = true;
      else changes.push({ from, to: from + written.length, insert: moved });
    },
  });
  const pattern = tree.topNode.getChild("Line")?.getChild("Track")?.getChild("Pattern") ?? null;
  if (isBroken || pattern === null || pattern.to - PROBE.length !== text.trimEnd().length) return null;
  return applyChanges(text, changes).source;
}
