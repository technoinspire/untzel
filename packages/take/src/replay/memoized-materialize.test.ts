// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import type { SoundingRecipe } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { memoizedMaterialize } from "./memoized-materialize";

function counting() {
  const calls: SoundingRecipe[] = [];
  const materialize = (recipe: SoundingRecipe): Program => {
    calls.push(recipe);
    return { title: recipe.source } as unknown as Program;
  };
  return { calls, materialize: memoizedMaterialize(materialize, 8) };
}
const recipe = (source: string, solo: string | null = null): SoundingRecipe => ({ source, solo, preview: null });

describe("memoizedMaterialize", () => {
  it("does not materialize the same recipe twice", () => {
    const { calls, materialize } = counting();
    const first = materialize(recipe("a"));
    expect(materialize(recipe("a"))).toBe(first);
    expect(calls).toHaveLength(1);
  });
  it("lets the ninth recipe push out the oldest", () => {
    const { calls, materialize } = counting();
    for (let index = 0; index < 8; index += 1) materialize(recipe(`text ${index}`));
    materialize(recipe("text 0")); // the oldest becomes the newest
    materialize(recipe("text 8"));
    expect(calls).toHaveLength(9);
    materialize(recipe("text 0"));
    expect(calls).toHaveLength(9);
    materialize(recipe("text 1"));
    expect(calls).toHaveLength(10);
  });
  it("tells solo null from a track named null", () => {
    const { calls, materialize } = counting();
    materialize(recipe("a", null));
    materialize(recipe("a", "null"));
    expect(calls).toHaveLength(2);
  });
  it("keys a recipe with a preview by its track and text", () => {
    const { calls, materialize } = counting();
    expect(() => materialize(recipe("a"))).not.toThrow();
    materialize({ source: "a", solo: null, preview: { track: "bass", text: "bass: x" } });
    materialize({ source: "a", solo: null, preview: { track: "bass", text: "bass: x." } });
    materialize({ source: "a", solo: null, preview: { track: "bass", text: "bass: x" } });
    expect(calls).toHaveLength(3);
  });
});
