// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { readFileSync } from "node:fs";
import { parseManifest, type InstrumentManifest, type Program, type ResolvedParameter } from "@untzel/core";
import { describe, expect, it, vi } from "vitest";
import type { SamplePackData } from "../protocol";
import { SamplePackLoader, playsSamples, samplesChoices } from "./sample-packs";

const manifest = {
  format: 1,
  instrument: "choir",
  sampleRate: 48_000,
  frames: 4,
  zones: [{ position: 0, lowest: 0, highest: 127, root: 60, start: 0, loopStart: 1, loopEnd: 4, pan: 0 }],
};

const program = (...instruments: string[]): Program =>
  ({ tracks: instruments.map((instrument, index) => ({ name: `t${index}`, instrument, parameters: [] })) }) as unknown as Program;

function setup(frames = 4) {
  const fetch = vi.fn(async (url: string) =>
    url.endsWith(".json") ? new Response(JSON.stringify(manifest)) : new Response(new Uint8Array([1, 2, 3])),
  );
  const ready: SamplePackData[] = [];
  const loader = new SamplePackLoader({
    sources: [{ instrument: "choir", manifestUrl: "choir.json", audioUrl: "choir.opus" }],
    instruments: ["bass", "choir", "kick"],
    decode: async () => new Float32Array(frames).fill(0.5),
    fetch,
    onReady: (pack) => ready.push(pack),
  });
  return { loader, fetch, ready };
}

describe("SamplePackLoader", () => {
  it("fetches nothing for a program without a sampled instrument", async () => {
    const { loader, fetch } = setup();
    loader.want(program("kick", "bass"));
    expect(await loader.packsFor(program("kick"))).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads a pack once, hands it to the worklet once and keeps it for the export", async () => {
    const { loader, fetch, ready } = setup();
    loader.want(program("choir", "kick"));
    loader.want(program("choir"));
    const packs = await loader.packsFor(program("choir"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(ready).toHaveLength(1);
    expect(packs[0]?.instrumentId).toBe(1);
    expect(Array.from(packs[0]?.pcm ?? [])).toEqual([16_384, 16_384, 16_384, 16_384]);
  });

  it("gives the packs of instrument names, once each, like those of a program", async () => {
    const { loader, fetch } = setup();
    expect(await loader.packsForInstruments(["kick", "bass"])).toEqual([]);
    const packs = await loader.packsForInstruments(["choir", "kick", "choir"]);
    expect(packs.map((pack) => pack.instrumentId)).toEqual([1]);
    expect(await loader.packsFor(program("choir"))).toEqual(packs);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("leaves the track on its synth voice when the decoded length is wrong", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { loader, ready } = setup(5);
    expect(await loader.packsFor(program("choir"))).toEqual([]);
    expect(ready).toHaveLength(0);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

// The registry's own manifests: the choice order and the defaults are the instruments'.
function manifestOf(name: string): InstrumentManifest {
  const read = parseManifest(JSON.parse(readFileSync(new URL(`../../../../instruments/${name}/manifest.json`, import.meta.url), "utf8")));
  if (!read.ok) throw new Error(`${name}: ${JSON.stringify(read.issues)}`);
  return read.manifest;
}
const CHOICES = samplesChoices([manifestOf("kick"), manifestOf("vox"), manifestOf("choir")]);
/** A track as the language resolves it: `source` always carries the sound's or the default's choice. */
const voice = (instrument: string, source: "synth" | "samples") => ({
  name: instrument,
  instrument,
  parameters: [{ index: 37, name: "source", value: { kind: "constant", value: source === "samples" ? 1 : 0 }, explicit: false } satisfies ResolvedParameter],
});
const voices = (...tracks: ReturnType<typeof voice>[]): Program => ({ tracks }) as unknown as Program;

// A text with only `vox talk` fetched the 360 KB vox pack it never played: the decision is the track's resolved source, not the instrument's name.
describe("the sample pack decision", () => {
  it("knows where samples sit among vox's and choir's source choices", () => {
    expect([...CHOICES]).toEqual([["vox", 1], ["choir", 1]]);
  });
  it("plays samples only when the resolved source says so", () => {
    expect(playsSamples(voice("vox", "synth"), CHOICES), "vox, vox talk, vox robot").toBe(false);
    expect(playsSamples(voice("vox", "samples"), CHOICES), "vox ooh, vox aah").toBe(true);
    expect(playsSamples(voice("choir", "samples"), CHOICES), "choir").toBe(true);
    expect(playsSamples(voice("choir", "synth"), CHOICES), "choir dark").toBe(false);
    expect(playsSamples({ instrument: "kick", parameters: [] }, CHOICES), "unknown: loads as before").toBe(true);
  });
  it("fetches nothing for vox talk alone, and the pack for vox ooh", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith(".json") ? new Response(JSON.stringify({ ...manifest, instrument: "vox" })) : new Response(new Uint8Array([1, 2, 3])),
    );
    const loader = new SamplePackLoader({
      sources: [{ instrument: "vox", manifestUrl: "vox.json", audioUrl: "vox.opus" }],
      instruments: ["kick", "vox"],
      samplesChoice: CHOICES,
      decode: async () => new Float32Array(4).fill(0.5),
      fetch,
      onReady: () => undefined,
    });
    loader.want(voices(voice("vox", "synth")));
    expect(await loader.packsFor(voices(voice("vox", "synth")))).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    loader.want(voices(voice("vox", "synth"), voice("vox", "samples")));
    expect((await loader.packsFor(voices(voice("vox", "samples")))).map((pack) => pack.instrumentId)).toEqual([1]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
