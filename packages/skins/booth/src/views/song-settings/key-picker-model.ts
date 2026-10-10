// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { SCALE_NAMES, tonicToPitchClass, type ScaleName } from "@untzel/core";
import { strings } from "../../copy/copy";

// The key picker of the transport: 12 tonics and 5 scales. A tonic
// spelled by hand (`d#`) lights its pitch (Eb) and stays as written until another one is
// picked. The text spells tonics in lower case, like the transport (`a minor`).

export interface TonicOption {
  /** What the button shows: "Eb". */
  readonly label: string;
  /** What the text gets: "eb". */
  readonly text: string;
  readonly isChosen: boolean;
}

export interface ScaleOption {
  readonly scale: ScaleName;
  readonly description: string;
  readonly isChosen: boolean;
}

export interface KeyPickerModel {
  readonly tonics: readonly TonicOption[];
  readonly scales: readonly ScaleOption[];
  readonly note: string;
}

const TONICS = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"] as const;

/** What a scale sounds like, in the current language: "dark, the techno default". */
export function scaleDescription(scale: ScaleName): string {
  switch (scale) {
    case "minor":
      return strings.minorHint;
    case "major":
      return strings.majorHint;
    case "dorian":
      return strings.dorianHint;
    case "phrygian":
      return strings.phrygianHint;
    case "chromatic":
      return strings.chromaticHint;
  }
}

function label(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export function keyPickerModel(tonic: string, scale: ScaleName): KeyPickerModel {
  const pitch = tonicToPitchClass(tonic);
  return {
    tonics: TONICS.map((text, index) => ({ label: label(text), text, isChosen: index === pitch })),
    scales: SCALE_NAMES.map((name) => ({ scale: name, description: scaleDescription(name), isChosen: name === scale })),
    note: scale === "chromatic" ? strings.chromaticNote : strings.keyNote,
  };
}
