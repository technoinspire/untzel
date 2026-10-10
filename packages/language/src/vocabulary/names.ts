// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { EditableSource } from "../edits/document";

// The names a text declares, read from the syntax tree, so they are known even while the
// text has errors (completion, the terminal's vocabulary). Never validates anything.

export interface DeclaredTrack {
  /** The name the analysis gives it, automatic names included. */
  readonly name: string;
  readonly instrument: string;
  /** 1-based physical line. */
  readonly line: number;
}

export interface DeclaredSection {
  readonly name: string;
  readonly tracks: readonly string[];
  readonly line: number;
}

export interface DeclaredNames {
  readonly tracks: readonly DeclaredTrack[];
  readonly sections: readonly DeclaredSection[];
}

export function readNames(source: string): DeclaredNames {
  const document = new EditableSource(source);
  return {
    tracks: document.tracks.map((track) => ({ name: track.name, instrument: track.syntax.instrument.text, line: track.syntax.line + 1 })),
    sections: document.sections().map((section) => ({
      name: section.name.text,
      tracks: section.tracks.map((token) => token.text),
      line: section.line + 1,
    })),
  };
}
