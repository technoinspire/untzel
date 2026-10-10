// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import { soloProgram } from "./edits/solo";
import { previewProgram } from "./audition/track-preview";

/** What sounds, as text: the valid source, the held solo and the track preview in course. */
export interface SoundingRecipe {
  readonly source: string;
  readonly solo: string | null;
  readonly preview: { readonly track: string; readonly text: string } | null;
}

/** What sounds, analyzed: the program, the held solo and the preview's own program. */
export interface SoundingParts {
  readonly program: Program;
  readonly solo: string | null;
  readonly preview: { readonly track: string; readonly program: Program } | null;
}

/** What sounds: the track preview in the program, then the solo on top. */
export function soundingProgram(parts: SoundingParts): Program {
  const { program, solo, preview } = parts;
  const previewed = preview === null ? program : previewProgram(program, preview.track, preview.program);
  return solo === null ? previewed : soloProgram(previewed, solo);
}
