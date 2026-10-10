// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { parseManifest } from "./manifest";

const BASS = {
  name: "bass",
  group: "bass",
  kind: "pitched",
  range: { lowest: "c1", highest: "c4" },
  engine: "legacy",
  description: "Saw bass with a plucked filter",
  tags: ["bass", "saw"],
  voices: 2,
  allocation: "poly",
  steal: "oldest",
  costPerVoice: 1.4,
  patterns: [{ name: "Dotted", text: "c2 . . c2 . . c2 ." }],
  preview: ". c2 . c2 . c2 . eb2",
  defaultDuck: 0.6,
  parameters: [
    { name: "cutoff", min: 40, max: 8000, default: 600, unit: "Hz", curve: "exponential" },
    { name: "decay", min: 0.05, max: 2, default: 0.3, unit: "s", curve: "exponential" },
    { name: "drive", min: 0, max: 1, default: 0.1, unit: "", curve: "linear" },
  ],
  tone: [{ parameter: "cutoff", from: 120, to: 3000 }],
  presets: [{ name: "round", description: "Round and warm", values: {} }],
  defaultPreset: "round",
} as const;

const SCENE = { family: "floor", variant: { shape: "band" }, drive: "cutoff" } as const;

function issuesOf(scene: unknown, base: object = BASS): readonly { path: string; message: string }[] {
  const result = parseManifest({ ...base, scene });
  return result.ok ? [] : result.issues;
}

describe("the scene field", () => {
  it("reads a declared scene with its defaults", () => {
    const result = parseManifest({ ...BASS, scene: SCENE });
    expect(result.ok && result.manifest.scene).toEqual({ family: "floor", variant: { shape: "band", density: 2, tint: "track" }, drive: "cutoff" });
  });

  it("keeps density and tint when written", () => {
    const result = parseManifest({ ...BASS, scene: { ...SCENE, variant: { shape: "glow", density: 1, tint: "track-white-core" } } });
    expect(result.ok && result.manifest.scene).toMatchObject({ variant: { shape: "glow", density: 1, tint: "track-white-core" } });
  });

  it.each([
    [{ ...SCENE, family: "laser" }, "scene.family", "must be a scene family"],
    [{ ...SCENE, variant: { shape: "needle" } }, "scene.variant.shape", "must be a shape of floor"],
    [{ ...SCENE, variant: { shape: "band", density: 4 } }, "scene.variant.density", "must be 1, 2 or 3"],
    [{ ...SCENE, variant: { shape: "band", tint: "red" } }, "scene.variant.tint", "must be track or track-white-core"],
    [{ ...SCENE, drive: "loudness" }, "scene.drive", "must be a scene drive"],
    [{ ...SCENE, colour: "red" }, "scene.colour", "unknown field"],
    [{ ...SCENE, variant: { shape: "band", hue: 3 } }, "scene.variant.hue", "unknown field"],
  ])("rejects %j", (scene, path, message) => {
    expect(issuesOf(scene)).toContainEqual({ path, message });
  });

  it("needs a tone mapping for the cutoff drive", () => {
    expect(issuesOf(SCENE, { ...BASS, tone: [] })).toContainEqual({ path: "scene.drive", message: "cutoff needs a tone mapping" });
  });

  it("needs a tune or pitch parameter for a drum driven by pitch", () => {
    const drum = { ...BASS, kind: "drum", range: undefined, parameters: [BASS.parameters[1]], tone: [{ parameter: "decay", from: 0.1, to: 1 }] };
    const scene = { family: "mark", variant: { shape: "ping" }, drive: "pitch" };
    expect(issuesOf(scene, drum)).toContainEqual({ path: "scene.drive", message: "pitch needs notes or a tune parameter" });
  });

  it("leaves an absent scene to the category default", () => {
    const result = parseManifest(BASS);
    expect(result.ok && result.manifest.scene).toBeNull();
  });
});
