// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A typical take goes back and forth between a few texts (solo on and off, undo and
// redo): the last programs are kept instead of analyzed again.
import type { Program } from "@untzel/core";
import type { SoundingRecipe } from "@untzel/session";
import type { Materialize } from "./replay-ports";

/** An LRU of `size` programs keyed by JSON.stringify([source, solo, preview?.track ?? null, preview?.text ?? null]). */
export function memoizedMaterialize(materialize: Materialize, size: number): Materialize {
  const programs = new Map<string, Program>();
  return (recipe) => {
    const key = recipeKey(recipe);
    const kept = programs.get(key);
    if (kept !== undefined) {
      // The most recently used goes last; the first key is always the oldest.
      programs.delete(key);
      programs.set(key, kept);
      return kept;
    }
    const program = materialize(recipe);
    if (programs.size >= size) {
      const oldest = programs.keys().next();
      if (oldest.done !== true) programs.delete(oldest.value);
    }
    programs.set(key, program);
    return program;
  };
}

/** Tells solo null from a track named "null", and does not break without a preview. */
function recipeKey(recipe: SoundingRecipe): string {
  return JSON.stringify([recipe.source, recipe.solo, recipe.preview?.track ?? null, recipe.preview?.text ?? null]);
}
