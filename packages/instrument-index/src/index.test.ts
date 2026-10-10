// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fnv1a32 } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { manifests, samplePackInstruments } from "./generated/manifests";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const wasmPath = `${repo}packages/dsp/dist/untzel_dsp.wasm`;

function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const names = manifests.map((manifest) => (manifest as { name: string }).name).sort(byCodeUnit);

describe("instrument list", () => {
  it("ships the instruments of the library", () => {
    expect(names).toEqual(expect.arrayContaining(["kick", "hat", "bass", "piano", "epiano", "organ", "pluck", "choir"]));
  });

  it("equals the directories of instruments/", () => {
    const directories = readdirSync(`${repo}instruments`, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(`${repo}instruments/${entry.name}/manifest.json`))
      .map((entry) => entry.name)
      .sort(byCodeUnit);
    expect(names).toEqual(directories);
  });

  it("lists as sample packs exactly the directories with samples/v1/pack.json", () => {
    const packs = readdirSync(`${repo}instruments`, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(`${repo}instruments/${entry.name}/samples/v1/pack.json`))
      .map((entry) => entry.name)
      .sort(byCodeUnit);
    expect(samplePackInstruments).toEqual(packs);
  });
  it.skipIf(!existsSync(wasmPath))("equals INSTRUMENT_NAMES of the WASM (needs pnpm build:wasm)", () => {
    const instance = new WebAssembly.Instance(new WebAssembly.Module(readFileSync(wasmPath)), {});
    const dsp = instance.exports as { untzel_instrument_count(): number; untzel_instrument_name_hash(id: number): number };
    const hashes = Array.from({ length: dsp.untzel_instrument_count() }, (_, id) => dsp.untzel_instrument_name_hash(id) >>> 0);
    expect(hashes).toEqual(names.map((name) => fnv1a32(name)));
  });
});
