// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fetchOrder, generatedFiles, identifierOf, readInstruments, renderManifests, renderVoicePacks, staleFiles } from "./generate-instruments.mjs";
import { REPO } from "./lib.mjs";
/** A fake instruments/ folder: name → { manifest, pack }; a folder without manifest is skipped. */
function fakeFs(folders) {
  const files = new Map();
  for (const [folder, { manifest, pack }] of Object.entries(folders)) {
    if (manifest !== undefined) files.set(join("/r/instruments", folder, "manifest.json"), JSON.stringify(manifest));
    if (pack === true) files.set(join("/r/instruments", folder, "samples/v1/pack.json"), "{}");
  }
  return {
    readdirSync: () => Object.keys(folders).map((name) => ({ name, isDirectory: () => true })),
    existsSync: (path) => files.has(path),
    readFileSync: (path) => files.get(path),
  };
}
const tree = fakeFs({
  zither: { manifest: { name: "zither", group: "plucks", kind: "chord" }, pack: true },
  "fm-bass": { manifest: { name: "fm-bass", group: "bass", kind: "pitched" } },
  choir: { manifest: { name: "choir", group: "voices", kind: "chord" }, pack: true },
  clap: { manifest: { name: "clap", group: "drums", kind: "drum" }, pack: true },
  bell: { manifest: { name: "bell", group: "plucks", kind: "chord" }, pack: true },
  notes: {},
});
describe("generate-instruments", () => {
  const instruments = readInstruments("/r/instruments", tree);
  it("reads the folders with a manifest.json, in order of name", () => {
    expect(instruments.map((instrument) => instrument.name)).toEqual(["bell", "choir", "clap", "fm-bass", "zither"]);
  });
  it("names each import in camelCase", () => {
    expect(identifierOf("fm-bass")).toBe("fmBass");
    expect(renderManifests(instruments)).toContain('import fmBass from "../../../../instruments/fm-bass/manifest.json";');
  });
  it("lists as sample packs only the folders with samples/v1/pack.json, in order of name", () => {
    expect(renderManifests(instruments)).toContain('export const samplePackInstruments: readonly string[] = [\n  "bell",\n  "choir",\n  "clap",\n  "zither",\n];');
  });
  it("orders the packs melodic, voices, then percussion, by name within each", () => {
    expect(fetchOrder(instruments).map((instrument) => instrument.name)).toEqual(["bell", "zither", "choir", "clap"]);
    expect(renderVoicePacks(instruments)).toContain('  { instrument: "bell", manifestUrl: bellManifest, audioUrl: bellAudio },\n  { instrument: "zither"');
  });
  it("orders the 15 recorded packs of the repository exactly as the fetch order of v1.0.0", () => {
    const real = readInstruments(join(REPO, "instruments"));
    expect(fetchOrder(real).map((instrument) => instrument.name)).toEqual(["bell", "harp", "kalimba", "mallet", "piano", "strings", "choir", "vox", "bongo", "clap", "conga", "cowbell", "hat", "shaker", "woodblock"]);
  });
  it("writes two files whose content is a function of instruments/ only", () => {
    const files = generatedFiles("/r", tree);
    expect(files.map((file) => file.path)).toEqual(["packages/instrument-index/src/generated/manifests.ts", "apps/web/src/generated/voice-packs.ts"]);
    expect(generatedFiles("/r", tree)).toEqual(files);
  });
  it("finds a stale or missing file for --check, and none when the disk matches", () => {
    const files = generatedFiles("/r", tree);
    expect(staleFiles(files, (path) => files.find((file) => file.path === path).text)).toEqual([]);
    expect(staleFiles(files, (path) => (path === files[0].path ? "old" : null)).map((file) => file.path)).toEqual(files.map((file) => file.path));
  });
});
