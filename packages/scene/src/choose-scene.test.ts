// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parseManifest, type InstrumentManifest } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { chooseScene } from "./choose-scene";
import { CATEGORY_DEFAULTS } from "./scene-defaults";
import { lookSeed, sceneSeed } from "./scene-seeds";

const INSTRUMENTS = new URL("../../../instruments/", import.meta.url);
/** The folders with a manifest.json: a count written here would be one more list to edit per instrument. */
const manifestFolders = readdirSync(INSTRUMENTS, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/manifest.json`, INSTRUMENTS)));
const manifests = new Map<string, InstrumentManifest>(
  readdirSync(INSTRUMENTS).flatMap((name) => {
    let text: string;
    try {
      text = readFileSync(new URL(`${name}/manifest.json`, INSTRUMENTS), "utf8");
    } catch {
      return [];
    }
    const result = parseManifest(JSON.parse(text));
    return result.ok ? [[result.manifest.name, result.manifest] as const] : [];
  }),
);
const manifest = (name: string): InstrumentManifest => {
  const found = manifests.get(name);
  if (found === undefined) throw new Error(name);
  return found;
};
const seeds = { lightSourceHash: 0x1234abcd };

describe("chooseScene", () => {
  it("reads every manifest of instruments/, each with a declared scene", () => {
    expect(manifestFolders.length).toBeGreaterThan(0);
    expect(manifests.size).toBe(manifestFolders.length);
    for (const entry of manifests.values()) expect(entry.scene, entry.name).not.toBeNull();
  });

  it("gives every instrument of a group its own family and shape", () => {
    const seen = new Map<string, string>();
    for (const entry of manifests.values()) {
      const scene = chooseScene(entry, { name: "t", pan: 0 }, seeds);
      const key = `${entry.group} ${scene.family}/${scene.shape}`;
      expect(seen.get(key), `${entry.name} repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, entry.name);
    }
  });

  it.each([
    ["kick", "shockwave", "triple", "attack", "core"],
    ["boom", "shockwave", "dome", "envelope", "ground"],
    ["bell", "shockwave", "chime", "pitch", "wall"],
    ["hat", "sparks", "needle", "attack", "sky"],
    ["conga", "ripple", "triple", "velocity", "floor"],
    ["bass", "floor", "band", "cutoff", "ground"],
    ["supersaw", "ribbon", "fan", "cutoff", "horizon"],
    ["piano", "bars", "keyboard", "pitch", "wall"],
    ["pad", "fog", "cloud", "envelope", "field"],
    ["vox", "halo", "aura", "pitch", "wall"],
    ["riser", "sweep", "converge", "envelope", "field"],
    ["cowbell", "mark", "diamond", "attack", "orbit"],
  ])("%s draws %s/%s driven by %s in the %s", (name, family, shape, drive, zone) => {
    expect(chooseScene(manifest(name), { name: "t", pan: 0 }, seeds)).toMatchObject({ family, shape, drive, zone });
  });

  it("falls back to the category's default without a valid scene", () => {
    const bare = { ...manifest("pad"), scene: null };
    expect(chooseScene(bare, { name: "t", pan: 0 }, seeds)).toMatchObject({ family: "fog", shape: "cloud", category: "pad" });
    const odd = { ...manifest("vox"), group: "unknown", scene: null };
    expect(chooseScene(odd, { name: "t", pan: 0 }, seeds)).toMatchObject({ family: CATEGORY_DEFAULTS.drums.family, category: "drums" });
  });

  it("the same text gives the same scene", () => {
    const one = chooseScene(manifest("hat"), { name: "hat", pan: 0.2 }, seeds);
    const two = chooseScene(manifest("hat"), { name: "hat", pan: 0.2 }, seeds);
    expect(two).toEqual(one);
  });

  it("another track name gives another look and another colour slot draw", () => {
    const hat = chooseScene(manifest("hat"), { name: "hat", pan: 0 }, seeds);
    const ohat = chooseScene(manifest("hat"), { name: "ohat", pan: 0 }, seeds);
    expect(ohat.lookSeed).not.toBe(hat.lookSeed);
    expect(ohat.sceneSeed).not.toBe(hat.sceneSeed);
    expect([ohat.rotation, ohat.phase]).not.toEqual([hat.rotation, hat.phase]);
  });

  it("another text changes only the owner's seed, never the look", () => {
    const before = chooseScene(manifest("kick"), { name: "kick", pan: 0 }, seeds);
    const after = chooseScene(manifest("kick"), { name: "kick", pan: 0 }, { lightSourceHash: 0x99 });
    expect(after.sceneSeed).not.toBe(before.sceneSeed);
    expect({ ...after, sceneSeed: 0 }).toEqual({ ...before, sceneSeed: 0 });
  });

  it("keeps the seed formulas", () => {
    expect(lookSeed("kick", "kick")).toBe(lookSeed("kick", "kick"));
    expect(lookSeed("kick", "kick")).not.toBe(lookSeed("kick", "boom"));
    expect(sceneSeed(1, "kick")).not.toBe(sceneSeed(2, "kick"));
    expect(chooseScene(manifest("kick"), { name: "kick", pan: 0 }, seeds).sceneSeed).toBe(sceneSeed(seeds.lightSourceHash, "kick"));
  });
});
