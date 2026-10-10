// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The sample packs: decoded in Node to exactly the frames each pack was built
// with, and the export renders with them from its first sample, as the simulator does.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fnv1a32 } from "@untzel/core";
import { planExport } from "@untzel/export";
import { ExportAudio, programTimeline } from "@untzel/export/render-audio";
import { analyze } from "@untzel/language";
import { Transport } from "@untzel/transport";
import { describe, expect, it } from "vitest";
import { simRegistry } from "../registry";
import { simulate } from "./simulate";
import { samplePackInstruments } from "@untzel/instrument-index";
import { VOICE_PACKS, oggOpusPackets } from "./voice-packs";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const wasmPath = `${repo}packages/dsp/dist/untzel_dsp.wasm`;
const hasWasm = existsSync(wasmPath);
const CHOIR_TEXT = "tempo 120\nkey c minor\nchoir: choir Cm ~ ~ ~ / Ab ~ Bb ~ | gain 0.6\n";

describe("voice packs", () => {
  it("decodes every pack to the frames of its manifest, for its instrument", () => {
    const names = simRegistry().instruments.map((manifest) => manifest.name);
    expect(VOICE_PACKS.map((pack) => names[pack.instrumentId])).toEqual(samplePackInstruments);
    for (const pack of VOICE_PACKS) {
      const name = names[pack.instrumentId] ?? "";
      const manifest = JSON.parse(readFileSync(`${repo}instruments/${name}/samples/v1/pack.json`, "utf8")) as { frames: number; zones: unknown[] };
      expect(pack.pcm.length).toBe(manifest.frames);
      expect(pack.zones.length).toBe(manifest.zones.length * 8);
      const ogg = oggOpusPackets(readFileSync(`${repo}instruments/${name}/samples/v1/pack.opus`));
      expect(ogg.lastGranule - ogg.preSkip).toBe(manifest.frames);
    }
  });

  it.skipIf(!hasWasm)("the export sings the choir from the pack from its first sample, exactly as the simulator", () => {
    const { registry, instruments } = simRegistry();
    const names = instruments.map((manifest) => manifest.name);
    const analyzed = analyze(CHOIR_TEXT, registry);
    if (!analyzed.ok) throw new Error("choir text does not analyze");
    const wasm = new WebAssembly.Module(readFileSync(wasmPath));
    const planned = planExport(analyzed.program, { format: "audio", quality: "hd", range: { kind: "bars", bars: 8 }, mode: "loop", position: null }, false);
    if (!planned.ok) throw new Error(planned.reason);
    const { plan } = planned;
    const exportWith = (samplePacks: typeof VOICE_PACKS) =>
      new ExportAudio({
        plan,
        module: wasm,
        instruments: names,
        instrumentHashes: names.map((name) => fnv1a32(name)),
        timeline: programTimeline(plan, analyzed.program, (clock, sink) => new Transport({ clock, sink })),
        samplePacks,
      }).read(plan.musicFrames);
    const sampled = exportWith(VOICE_PACKS);
    const formant = exportWith([]);
    const reference = simulate({ program: analyzed.program, instruments: names, mode: "loop", sampleRate: 48_000, seconds: plan.musicSeconds + 0.5, wasm, now: () => 0, samplePacks: VOICE_PACKS });
    const start = reference.startFrame ?? 0;
    expect(Array.from(sampled.left)).toEqual(Array.from(reference.audio?.left.subarray(start, start + plan.musicFrames) ?? []));
    // The formants are centred; the recorded ensemble is spread from the first chord on.
    const firstBeat = Math.round(0.25 * 48_000);
    const spread = (block: { left: Float32Array; right: Float32Array }) => block.left.subarray(0, firstBeat).some((x, i) => x !== block.right[i]);
    expect(spread(sampled)).toBe(true);
    expect(spread(formant)).toBe(false);
  }, 60_000);
});
