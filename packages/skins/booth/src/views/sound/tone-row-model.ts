// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ToneSetByView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";

// Tone overridden by a written parameter: no silent dead control.
// The words of the row, the table cell and the toast, without the DOM.

/** A piece of "Set by open and cutoff": a parameter name is code, a word of the text. */
export interface SetByPart {
  readonly text: string;
  readonly isCode: boolean;
}

export interface ToneRowModel {
  /** False: Tone is shown inactive (aria-disabled) and Use Tone is offered. */
  readonly isActive: boolean;
  /** "Set by open", "Set by open and cutoff", "Set by cutoff (a signal)"; null when active. */
  readonly setBy: string | null;
  /** The same sentence in pieces, for the view to draw the names as code; empty when active. */
  readonly setByParts: readonly SetByPart[];
  /** Under Use Tone: what it does. */
  readonly useNote: string | null;
  /** "0.50". */
  readonly display: string;
}

/** "open", "open and cutoff", "open, cutoff and drive": names, then their connectors. */
function nameParts(parameters: readonly string[]): SetByPart[] {
  return parameters.flatMap((parameter, index) => {
    const name = { text: parameter, isCode: true };
    if (index === 0) return [name];
    return [{ text: index === parameters.length - 1 ? ` ${strings.and} ` : ", ", isCode: false }, name];
  });
}

function joined(parts: readonly SetByPart[]): string {
  return parts.map((part) => part.text).join("");
}

export function toneRowModel(tone: number, setBy: readonly ToneSetByView[]): ToneRowModel {
  const display = tone.toFixed(2);
  if (setBy.length === 0) return { isActive: true, setBy: null, setByParts: [], useNote: null, display };
  const names = nameParts(setBy.map((entry) => entry.parameter));
  const signal = setBy.length === 1 && setBy[0]?.isSignal === true ? [{ text: strings.aSignal, isCode: false }] : [];
  const setByParts = [{ text: strings.setBy, isCode: false }, ...names, ...signal];
  return {
    isActive: false,
    setBy: joined(setByParts),
    setByParts,
    useNote: strings.toneRemovesNote(joined(names)),
    display,
  };
}

/** What Use Tone took out, for its toast: "open", "open and cutoff". */
export function toneRemovedSubject(removed: readonly string[]): string {
  return joined(nameParts(removed));
}
